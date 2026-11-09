import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { bad, readJson, requireSession } from "@/lib/server/guard";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const denied = await requireSession();
  if (denied) return denied;
  const { id } = await ctx.params;
  const { day, done } = await readJson<{ day?: string; done?: boolean }>(req);
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return bad("day required");
  const where = and(eq(schema.taskCompletions.taskId, id), eq(schema.taskCompletions.day, day));
  if (done === false) await db().delete(schema.taskCompletions).where(where);
  else await db().insert(schema.taskCompletions).values({ taskId: id, day }).onConflictDoNothing();
  return NextResponse.json({ ok: true });
}
