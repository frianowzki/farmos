import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { bad, readJson, requireProfile } from "@/lib/server/guard";
import { clean, taskInput } from "@/lib/server/validate";
import { ownsProject } from "@/lib/server/owned";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const { id } = await ctx.params;
  const parsed = taskInput.safeParse(await readJson(req));
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "invalid");
  const patch = clean(parsed.data);
  if (patch.projectId && !(await ownsProject(pid, patch.projectId))) return bad("project not found", 404);
  const [row] = await db().update(schema.tasks).set(patch).where(and(eq(schema.tasks.profileId, pid), eq(schema.tasks.id, id))).returning();
  if (!row) return bad("not found", 404);
  return NextResponse.json({ task: row });
}

export async function DELETE(_: Request, ctx: Ctx) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const { id } = await ctx.params;
  await db().delete(schema.tasks).where(and(eq(schema.tasks.profileId, pid), eq(schema.tasks.id, id)));
  return NextResponse.json({ ok: true });
}
