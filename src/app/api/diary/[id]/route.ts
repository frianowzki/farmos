import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { bad, readJson, requireProfile } from "@/lib/server/guard";
import { clean, diaryInput } from "@/lib/server/validate";
import { ownedProjectIds } from "@/lib/server/owned";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const { id } = await ctx.params;
  const parsed = diaryInput.safeParse(await readJson(req));
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "invalid");
  const patch = clean(parsed.data);
  if (patch.projectIds) patch.projectIds = await ownedProjectIds(pid, patch.projectIds);
  const [row] = await db().update(schema.diaryEntries).set({ ...patch, updatedAt: new Date() }).where(and(eq(schema.diaryEntries.profileId, pid), eq(schema.diaryEntries.id, id))).returning();
  if (!row) return bad("not found", 404);
  return NextResponse.json({ entry: row });
}

export async function DELETE(_: Request, ctx: Ctx) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const { id } = await ctx.params;
  await db().delete(schema.diaryEntries).where(and(eq(schema.diaryEntries.profileId, pid), eq(schema.diaryEntries.id, id)));
  return NextResponse.json({ ok: true });
}
