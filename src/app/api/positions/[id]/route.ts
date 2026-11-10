import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { bad, readJson, requireProfile } from "@/lib/server/guard";
import { clean, positionInput } from "@/lib/server/validate";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const { id } = await ctx.params;
  const parsed = positionInput.safeParse(await readJson(req));
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "invalid");
  const { projectId: _ignored, ...rest } = clean(parsed.data);
  void _ignored;
  const [row] = await db().update(schema.positions).set(rest).where(and(eq(schema.positions.profileId, pid), eq(schema.positions.id, id))).returning();
  if (!row) return bad("not found", 404);
  return NextResponse.json({ position: row });
}

export async function DELETE(_: Request, ctx: Ctx) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const { id } = await ctx.params;
  await db().delete(schema.positions).where(and(eq(schema.positions.profileId, pid), eq(schema.positions.id, id)));
  return NextResponse.json({ ok: true });
}
