import { asc, gte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { bad, readJson, requireSession } from "@/lib/server/guard";
import { clean, taskInput } from "@/lib/server/validate";

export async function GET() {
  const denied = await requireSession();
  if (denied) return denied;
  const since = new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10);
  const [tasks, completions] = await Promise.all([
    db().select().from(schema.tasks).orderBy(asc(schema.tasks.sortOrder), asc(schema.tasks.createdAt)),
    db().select({ taskId: schema.taskCompletions.taskId, day: schema.taskCompletions.day }).from(schema.taskCompletions).where(gte(schema.taskCompletions.day, since)),
  ]);
  return NextResponse.json({ tasks, completions });
}

export async function POST(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  const parsed = taskInput.safeParse(await readJson(req));
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "invalid");
  const v = clean(parsed.data);
  if (!v.title || !v.startDate) return bad("title and startDate are required");
  const [row] = await db().insert(schema.tasks).values({ ...v, title: v.title, startDate: v.startDate }).returning();
  return NextResponse.json({ task: row }, { status: 201 });
}
