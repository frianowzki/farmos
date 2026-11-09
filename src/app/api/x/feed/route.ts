import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireSession } from "@/lib/server/guard";
import { accessToken, isConfigured } from "@/lib/server/connections";

export const dynamic = "force-dynamic";

type XUser = { id: string; name: string; username: string; profile_image_url?: string; verified?: boolean };
type XTweet = { id: string; text: string; created_at?: string; author_id?: string; public_metrics?: { like_count: number; retweet_count: number; reply_count: number; quote_count?: number; impression_count?: number }; attachments?: { media_keys?: string[] } };
type XMedia = { media_key: string; type: string; url?: string; preview_image_url?: string; width?: number; height?: number };

let cache: { at: number; key: string; body: unknown } | null = null;

/** Reverse-chronological home timeline of the connected X account (read-only). */
export async function GET(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  if (!isConfigured("x")) return NextResponse.json({ state: "not-configured", posts: [] });
  const [row] = await db().select().from(schema.connectedAccounts).where(eq(schema.connectedAccounts.provider, "x")).limit(1);
  if (!row) return NextResponse.json({ state: "not-connected", posts: [] });
  const source = new URL(req.url).searchParams.get("source") === "me" ? "me" : "home";
  const key = `${source}`;
  // X API reads are metered; keep a 5-minute cache to stay inside small tiers.
  if (cache && cache.key === key && Date.now() - cache.at < 5 * 60_000) return NextResponse.json(cache.body);
  const token = await accessToken("x");
  if (!token) return NextResponse.json({ state: "reconnect", posts: [], message: "X token expired. Reconnect X in Settings." });
  const path = source === "me" ? `users/${row.providerAccountId}/tweets` : `users/${row.providerAccountId}/timelines/reverse_chronological`;
  const qs = new URLSearchParams({
    max_results: "20",
    "tweet.fields": "created_at,public_metrics,author_id,attachments",
    expansions: "author_id,attachments.media_keys",
    "user.fields": "name,username,profile_image_url,verified",
    "media.fields": "type,url,preview_image_url,width,height",
  });
  const res = await fetch(`https://api.x.com/2/${path}?${qs}`, { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!res.ok) {
    const msg =
      res.status === 429
        ? "X rate limit reached. Try again in a few minutes."
        : res.status === 403 || res.status === 402
          ? "Your X API plan doesn't include timeline reads. Free tier apps can sign in but can't read timelines; Basic or pay-per-use is needed."
          : `X returned ${res.status}.`;
    return NextResponse.json({ state: "error", posts: [], message: msg });
  }
  const j = (await res.json()) as { data?: XTweet[]; includes?: { users?: XUser[]; media?: XMedia[] } };
  const users = new Map((j.includes?.users ?? []).map((u) => [u.id, u]));
  const media = new Map((j.includes?.media ?? []).map((m) => [m.media_key, m]));
  const posts = (j.data ?? []).map((t) => {
    const u = users.get(t.author_id ?? "");
    return {
      id: t.id,
      text: t.text,
      createdAt: t.created_at ?? null,
      url: u ? `https://x.com/${u.username}/status/${t.id}` : `https://x.com/i/web/status/${t.id}`,
      author: u ? { name: u.name, username: u.username, image: u.profile_image_url ?? null, verified: Boolean(u.verified) } : null,
      metrics: t.public_metrics ?? null,
      media: (t.attachments?.media_keys ?? []).map((k) => media.get(k)).filter(Boolean).map((m) => ({ type: m!.type, url: m!.url ?? m!.preview_image_url ?? null })),
    };
  });
  const body = { state: "ok", source, posts };
  cache = { at: Date.now(), key, body };
  return NextResponse.json(body);
}
