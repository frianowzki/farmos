import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { bad, readJson, requireSession } from "@/lib/server/guard";
import { getDrop, openseaConfigured } from "@/lib/server/opensea";

type Ctx = { params: Promise<{ slug: string }> };
const slugOk = (s: string) => /^[a-z0-9-_.]{1,120}$/i.test(s);

export async function GET(_: Request, ctx: Ctx) {
  const denied = await requireSession();
  if (denied) return denied;
  const { slug } = await ctx.params;
  if (!slugOk(slug)) return bad("bad slug");
  const [watch] = await db().select().from(schema.mintWatch).where(eq(schema.mintWatch.slug, slug));
  if (!openseaConfigured()) return NextResponse.json({ configured: false, drop: null, watch: watch ?? null });
  try {
    return NextResponse.json({ configured: true, drop: await getDrop(slug), watch: watch ?? null });
  } catch (e) {
    return NextResponse.json({ configured: true, drop: null, watch: watch ?? null, error: (e as Error).message });
  }
}

const patch = z.object({
  name: z.string().max(200).nullish(),
  chain: z.string().max(40).nullish(),
  contract: z.string().max(80).nullish(),
  startTime: z.string().datetime({ offset: true }).nullish(),
  manualStatus: z.enum(["unknown", "eligible", "not_eligible", "applied", "pending"]).optional(),
  checkerUrl: z.string().url().max(500).nullish().or(z.literal("")),
  note: z.string().max(4000).nullish(),
});

/** Watch a drop, or update its manual WL status / checker link. */
export async function PATCH(req: Request, ctx: Ctx) {
  const denied = await requireSession();
  if (denied) return denied;
  const { slug } = await ctx.params;
  if (!slugOk(slug)) return bad("bad slug");
  const p = patch.safeParse(await readJson(req));
  if (!p.success) return bad(p.error.issues[0]?.message ?? "invalid");
  const v = { ...p.data, checkerUrl: p.data.checkerUrl || null, startTime: p.data.startTime ? new Date(p.data.startTime) : p.data.startTime === null ? null : undefined };
  const clean = Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined));
  const [row] = await db()
    .insert(schema.mintWatch)
    .values({ slug, ...clean })
    .onConflictDoUpdate({ target: schema.mintWatch.slug, set: { ...clean, updatedAt: new Date() } })
    .returning();
  return NextResponse.json({ watch: row });
}

export async function DELETE(_: Request, ctx: Ctx) {
  const denied = await requireSession();
  if (denied) return denied;
  const { slug } = await ctx.params;
  await db().delete(schema.mintWatch).where(eq(schema.mintWatch.slug, slug));
  return NextResponse.json({ ok: true });
}
