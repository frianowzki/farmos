import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { bad, readJson, requireProfile } from "@/lib/server/guard";
import { clean, isUuid, watchInput } from "@/lib/server/validate";

type Ctx = { params: Promise<{ id: string }> };

/** Set or clear alerts ({ above, below, alertCurrency }); changing them re-arms both alerts. */
export async function PATCH(req: Request, ctx: Ctx) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const { id } = await ctx.params;
  if (!isUuid(id)) return bad("not found", 404);
  const parsed = watchInput.safeParse(await readJson(req));
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "invalid");
  const { coinId: _c, ...rest } = clean(parsed.data);
  void _c;
  if (!Object.keys(rest).length) return bad("nothing to update");
  const touchesAlerts = "above" in rest || "below" in rest || "alertCurrency" in rest;
  const [row] = await db()
    .update(schema.watchlist)
    .set({ ...rest, ...(touchesAlerts ? { alertState: {} } : {}) })
    .where(and(eq(schema.watchlist.profileId, pid), eq(schema.watchlist.id, id)))
    .returning();
  if (!row) return bad("not found", 404);
  return NextResponse.json({ item: row });
}

export async function DELETE(_: Request, ctx: Ctx) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const { id } = await ctx.params;
  if (!isUuid(id)) return bad("not found", 404);
  const r = await db().delete(schema.watchlist).where(and(eq(schema.watchlist.profileId, pid), eq(schema.watchlist.id, id))).returning({ id: schema.watchlist.id });
  if (!r.length) return bad("not found", 404);
  return NextResponse.json({ ok: true });
}
