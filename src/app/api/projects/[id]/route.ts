import { arrayContains, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { bad, readJson, requireSession } from "@/lib/server/guard";
import { clean, projectInput } from "@/lib/server/validate";

type Ctx = { params: Promise<{ id: string }> };
const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

export async function GET(_: Request, ctx: Ctx) {
  const denied = await requireSession();
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!isUuid(id)) return bad("not found", 404);
  const [project] = await db().select().from(schema.projects).where(eq(schema.projects.id, id)).limit(1);
  if (!project) return bad("not found", 404);
  const [positions, tasks, diary, calendar, attachments] = await Promise.all([
    db().select().from(schema.positions).where(eq(schema.positions.projectId, id)).orderBy(desc(schema.positions.createdAt)),
    db().select().from(schema.tasks).where(eq(schema.tasks.projectId, id)),
    db().select().from(schema.diaryEntries).where(arrayContains(schema.diaryEntries.projectIds, [id])).orderBy(desc(schema.diaryEntries.day)),
    db().select().from(schema.calendarLinks).where(eq(schema.calendarLinks.projectId, id)),
    db().select().from(schema.attachments).where(eq(schema.attachments.projectId, id)).orderBy(desc(schema.attachments.createdAt)),
  ]);
  return NextResponse.json({ project, positions, tasks, diary, calendar, attachments });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const denied = await requireSession();
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!isUuid(id)) return bad("not found", 404);
  const parsed = projectInput.safeParse(await readJson(req));
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "invalid");
  const [row] = await db()
    .update(schema.projects)
    .set({ ...clean(parsed.data), updatedAt: new Date() })
    .where(eq(schema.projects.id, id))
    .returning();
  if (!row) return bad("not found", 404);
  return NextResponse.json({ project: row });
}

export async function DELETE(_: Request, ctx: Ctx) {
  const denied = await requireSession();
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!isUuid(id)) return bad("not found", 404);
  await db().delete(schema.projects).where(eq(schema.projects.id, id));
  return NextResponse.json({ ok: true });
}
