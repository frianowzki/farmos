import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import type { AirdropChecker } from "@/db/schema";
import { validateChecker } from "@/lib/server/airdrop-check";
import { checkClaims } from "@/lib/server/alerts";
import { bad, readJson, requireProfile } from "@/lib/server/guard";

type Ctx = { params: Promise<{ id: string }> };
const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);
export const maxDuration = 60;

async function load(pid: string, id: string) {
  const [p] = await db().select().from(schema.projects).where(and(eq(schema.projects.profileId, pid), eq(schema.projects.id, id))).limit(1);
  return p;
}

/** Save (or clear with { checker: null }) the project's read-only checker config. */
export async function PUT(req: Request, ctx: Ctx) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const { id } = await ctx.params;
  if (!isUuid(id)) return bad("not found", 404);
  const { checker } = await readJson<{ checker?: Partial<AirdropChecker> | null }>(req);
  if (checker === null) {
    await db().update(schema.projects).set({ checker: null, updatedAt: new Date() }).where(and(eq(schema.projects.profileId, pid), eq(schema.projects.id, id)));
    return NextResponse.json({ checker: null });
  }
  const c = checker ?? {};
  const err = validateChecker(c);
  if (err) return bad(err);
  const clean: AirdropChecker = {
    type: c.type!,
    url: c.url?.trim() || undefined,
    path: c.path?.trim() || undefined,
    chain: c.chain?.trim() || undefined,
    address: c.address?.trim() || undefined,
    fn: c.fn?.trim() || undefined,
    decimals: typeof c.decimals === "number" && c.decimals >= 0 && c.decimals <= 36 ? c.decimals : undefined,
    claimUrl: c.claimUrl?.trim() && /^https:\/\//.test(c.claimUrl.trim()) ? c.claimUrl.trim() : undefined,
    match: c.type === "page" ? c.match?.trim().slice(0, 120) || undefined : undefined,
    claimStatus: c.claimStatus ?? "unknown",
    autoCheck: c.autoCheck !== false,
    alerts: null,
    lastRun: null,
  };
  const [row] = await db().update(schema.projects).set({ checker: clean, updatedAt: new Date() }).where(and(eq(schema.projects.profileId, pid), eq(schema.projects.id, id))).returning();
  if (!row) return bad("not found", 404);
  return NextResponse.json({ checker: row.checker });
}

/** Quick edits without resetting the check: { claimStatus } and/or { autoCheck }. */
export async function PATCH(req: Request, ctx: Ctx) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const { id } = await ctx.params;
  if (!isUuid(id)) return bad("not found", 404);
  const b = await readJson<{ claimStatus?: string; autoCheck?: boolean }>(req);
  const p = await load(pid, id);
  if (!p) return bad("not found", 404);
  const cur: AirdropChecker = p.checker ?? { type: "manual", claimStatus: "unknown", autoCheck: false };
  const next: AirdropChecker = { ...cur };
  if (b.claimStatus !== undefined) {
    if (!["unknown", "upcoming", "open", "claimed", "closed"].includes(b.claimStatus)) return bad("Unknown claim status");
    next.claimStatus = b.claimStatus as AirdropChecker["claimStatus"];
  }
  if (typeof b.autoCheck === "boolean") next.autoCheck = b.autoCheck;
  await db().update(schema.projects).set({ checker: next, updatedAt: new Date() }).where(and(eq(schema.projects.profileId, pid), eq(schema.projects.id, id)));
  return NextResponse.json({ checker: next });
}

/** Run the check now (same as the cron, incl. Telegram alert on a new event) for this project. */
export async function POST(_: Request, ctx: Ctx) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const { id } = await ctx.params;
  if (!isUuid(id)) return bad("not found", 404);
  const p = await load(pid, id);
  if (!p) return bad("not found", 404);
  if (!p.checker) return bad("No checker configured", 412);
  if (p.checker.type === "manual") return bad("Manual status only, nothing to check", 412);
  const r = await checkClaims(pid, { projectId: id });
  const after = await load(pid, id);
  const err = after?.checker?.lastRun?.results.find((x) => x.wallet === "check" && x.status === "error");
  if (err) return bad(err.detail ?? "Check failed", 412);
  return NextResponse.json({ checker: after?.checker ?? null, alerts: r.alerts });
}
