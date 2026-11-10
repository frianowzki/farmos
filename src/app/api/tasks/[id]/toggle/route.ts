import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { bad, readJson, requireProfile } from "@/lib/server/guard";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const { id } = await ctx.params;
  const { day, done } = await readJson<{ day?: string; done?: boolean }>(req);
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return bad("day required");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return bad("not found", 404);
  const [task] = await db().select({ id: schema.tasks.id }).from(schema.tasks).where(and(eq(schema.tasks.profileId, pid), eq(schema.tasks.id, id))).limit(1);
  if (!task) return bad("not found", 404);
  const where = and(eq(schema.taskCompletions.profileId, pid), eq(schema.taskCompletions.taskId, id), eq(schema.taskCompletions.day, day));
  if (done === false) await db().delete(schema.taskCompletions).where(where);
  else await db().insert(schema.taskCompletions).values({ taskId: id, day, profileId: pid }).onConflictDoNothing();
  return NextResponse.json({ ok: true });
}
