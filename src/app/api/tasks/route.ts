import { and, asc, eq, gte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { bad, readJson, requireProfile } from "@/lib/server/guard";
import { clean, taskInput } from "@/lib/server/validate";
import { ownsProject } from "@/lib/server/owned";

export async function GET() {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const since = new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10);
  const [tasks, completions] = await Promise.all([
    db().select().from(schema.tasks).where(eq(schema.tasks.profileId, pid)).orderBy(asc(schema.tasks.sortOrder), asc(schema.tasks.createdAt)),
    db().select({ taskId: schema.taskCompletions.taskId, day: schema.taskCompletions.day }).from(schema.taskCompletions).where(and(eq(schema.taskCompletions.profileId, pid), gte(schema.taskCompletions.day, since))),
  ]);
  return NextResponse.json({ tasks, completions });
}

export async function POST(req: Request) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const parsed = taskInput.safeParse(await readJson(req));
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "invalid");
  const v = clean(parsed.data);
  if (!v.title || !v.startDate) return bad("title and startDate are required");
  if (v.projectId && !(await ownsProject(pid, v.projectId))) return bad("project not found", 404);
  const [row] = await db().insert(schema.tasks).values({ ...v, title: v.title, startDate: v.startDate, profileId: pid }).returning();
  return NextResponse.json({ task: row }, { status: 201 });
}
