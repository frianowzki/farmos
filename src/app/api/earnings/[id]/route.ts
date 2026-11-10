import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { bad, readJson, requireProfile } from "@/lib/server/guard";
import { clean, earningInput, isUuid } from "@/lib/server/validate";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const { id } = await ctx.params;
  if (!isUuid(id)) return bad("not found", 404);
  const parsed = earningInput.safeParse(await readJson(req));
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "invalid");
  // The project link can't be moved (and never to another profile's project).
  const { projectId: _p, ...rest } = clean(parsed.data);
  void _p;
  if (rest.symbol) rest.symbol = rest.symbol.toUpperCase();
  if (!Object.keys(rest).length) return bad("nothing to update");
  const [row] = await db().update(schema.earnings).set(rest).where(and(eq(schema.earnings.profileId, pid), eq(schema.earnings.id, id))).returning();
  if (!row) return bad("not found", 404);
  return NextResponse.json({ earning: row });
}

export async function DELETE(_: Request, ctx: Ctx) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const { id } = await ctx.params;
  if (!isUuid(id)) return bad("not found", 404);
  const r = await db().delete(schema.earnings).where(and(eq(schema.earnings.profileId, pid), eq(schema.earnings.id, id))).returning({ id: schema.earnings.id });
  if (!r.length) return bad("not found", 404);
  return NextResponse.json({ ok: true });
}
