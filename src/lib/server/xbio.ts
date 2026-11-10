import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { accessToken, isConfigured } from "./connections";
import { guardedFetch } from "./ssrf";
import { xHandle } from "@/lib/project-utils";

export type BioSource = "x-api" | "fxtwitter" | "vxtwitter" | "website";
export type Bio = { bio: string; source: BioSource; tried?: string[] } | null;

const tidy = (s: string) => s.replace(/https?:\/\/t\.co\/\S+/g, "").replace(/\s+/g, " ").trim().slice(0, 240);
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

// Bios rarely change: one lookup per handle per day per server instance.
const cache = new Map<string, { at: number; v: Bio }>();

/** X bio via the connected X account (users/by/username). Returns null on plans without user lookup. */
async function viaXApi(pid: string, handle: string, log: string[]): Promise<string | null> {
  if (!isConfigured("x")) return (log.push("x-api: not configured"), null);
  const [row] = await db().select({ id: schema.connectedAccounts.providerAccountId }).from(schema.connectedAccounts).where(and(eq(schema.connectedAccounts.profileId, pid), eq(schema.connectedAccounts.provider, "x"))).limit(1);
  if (!row) return (log.push("x-api: X not connected"), null);
  const token = await accessToken(pid, "x");
  if (!token) return (log.push("x-api: token expired"), null);
  const r = await fetch(`https://api.x.com/2/users/by/username/${handle}?user.fields=description`, { headers: { authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(5_000) }).catch(() => null);
  log.push(`x-api: ${r?.status ?? "timeout"}`);
  if (!r?.ok) return null;
  const j = (await r.json().catch(() => null)) as { data?: { description?: string } } | null;
  return j?.data?.description?.trim() || null;
}

async function viaPublic(handle: string, host: "api.fxtwitter.com" | "api.vxtwitter.com"): Promise<string | null> {
  const r = await fetch(`https://${host}/${handle}`, { cache: "no-store", signal: AbortSignal.timeout(5_000), headers: { "user-agent": "farmOS/1.0" } }).catch(() => null);
  if (!r?.ok) return null;
  const j = (await r.json().catch(() => null)) as { user?: { description?: string }; description?: string } | null;
  return (j?.user?.description ?? j?.description)?.trim() || null;
}

async function viaWebsite(site: string): Promise<string | null> {
  const url = /^https?:\/\//i.test(site) ? site : `https://${site}`;
  const r = await guardedFetch(url, { signal: AbortSignal.timeout(5_000), headers: { accept: "text/html", "user-agent": "Mozilla/5.0 farmOS" } }).catch(() => null);
  if (!r?.ok) return null;
  const html = (await r.text().catch(() => "")).slice(0, 300_000);
  const meta = (name: string) =>
    html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']+)["']`, "i"))?.[1] ??
    html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${name}["']`, "i"))?.[1];
  const d = meta("og:description") ?? meta("description") ?? meta("twitter:description");
  return d ? decode(d).trim() || null : null;
}

/** One-line summary for a project: X bio (own X API → fxtwitter → vxtwitter), else the website's og:description. */
export async function projectBio(pid: string, links: Record<string, string | undefined> | null | undefined): Promise<Bio> {
  const handle = xHandle(links?.x);
  const site = links?.site?.trim();
  const key = `${handle ?? ""}|${site ?? ""}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 24 * 3600_000) return hit.v;
  let v: Bio = null;
  const tried: string[] = [];
  if (handle) {
    const x = await viaXApi(pid, handle, tried).catch(() => null);
    if (x) v = { bio: tidy(x), source: "x-api" };
    for (const host of ["api.fxtwitter.com", "api.vxtwitter.com"] as const) {
      if (v) break;
      const b = await viaPublic(handle, host);
      tried.push(`${host}: ${b ? "ok" : "miss"}`);
      if (b) v = { bio: tidy(b), source: host === "api.fxtwitter.com" ? "fxtwitter" : "vxtwitter" };
    }
  }
  if (!v && site) {
    const w = await viaWebsite(site).catch(() => null);
    tried.push(`website: ${w ? "ok" : "miss"}`);
    if (w) v = { bio: tidy(w), source: "website" };
  }
  if (v && !v.bio) v = null;
  if (v) v.tried = tried;
  if (v) cache.set(key, { at: Date.now(), v });
  return v;
}

/** Fill an empty summary from the bio (never overwrites one the user wrote). Returns the updated row or null. */
export async function autofillSummary(pid: string, project: { id: string; summary: string | null; links: Record<string, string | undefined> | null }) {
  if (project.summary?.trim() || !(project.links?.x || project.links?.site)) return null;
  const b = await Promise.race([projectBio(pid, project.links), new Promise<Bio>((r) => setTimeout(() => r(null), 6_000))]);
  if (!b) return null;
  const [row] = await db()
    .update(schema.projects)
    .set({ summary: b.bio })
    .where(and(eq(schema.projects.profileId, pid), eq(schema.projects.id, project.id)))
    .returning();
  return row && (row.summary === b.bio ? row : null);
}
