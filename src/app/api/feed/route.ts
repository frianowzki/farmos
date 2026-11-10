import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { bad, readJson, requireProfile } from "@/lib/server/guard";
import { getProfileTz } from "@/lib/server/settings";
import { dayIn } from "@/lib/server/tz";

export async function GET() {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const rows = await db().select().from(schema.feedItems).where(eq(schema.feedItems.profileId, pid)).orderBy(desc(schema.feedItems.day), desc(schema.feedItems.score)).limit(80);
  return NextResponse.json({ items: rows });
}

const Save = z.object({
  title: z.string().trim().min(2).max(300),
  url: z.string().url().max(2000).refine((u) => /^https?:\/\//.test(u)),
  summary: z.string().max(1000).catch(""),
  source: z.string().max(80).nullable().catch(null),
  category: z.enum(["airdrop", "testnet", "nft", "degen", "news"]).nullable().catch(null),
});

/** Save a News wire headline to this profile's reading list (kind "saved"; kept when the list is rebuilt). */
export async function POST(req: Request) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const p = Save.safeParse(await readJson(req));
  if (!p.success) return bad("Invalid item");
  const existing = await db().select({ id: schema.feedItems.id }).from(schema.feedItems).where(and(eq(schema.feedItems.profileId, pid), eq(schema.feedItems.url, p.data.url), eq(schema.feedItems.kind, "saved"))).limit(1);
  if (existing[0]) return NextResponse.json({ id: existing[0].id, saved: true });
  const day = dayIn(new Date(), await getProfileTz(pid));
  const [row] = await db().insert(schema.feedItems).values({ profileId: pid, day, kind: "saved", title: p.data.title.slice(0, 300), summary: p.data.summary.slice(0, 600), url: p.data.url, source: p.data.source, category: p.data.category, score: 100 }).returning();
  return NextResponse.json({ id: row.id, saved: true });
}

/** Remove a saved item (only this profile's). ?url= or ?id= */
export async function DELETE(req: Request) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const sp = new URL(req.url).searchParams;
  const id = sp.get("id");
  const url = sp.get("url");
  if (!id && !url) return bad("id or url required");
  if (id && !z.string().uuid().safeParse(id).success) return bad("Invalid id");
  await db().delete(schema.feedItems).where(and(eq(schema.feedItems.profileId, pid), eq(schema.feedItems.kind, "saved"), id ? eq(schema.feedItems.id, id) : eq(schema.feedItems.url, url!)));
  return NextResponse.json({ ok: true });
}
