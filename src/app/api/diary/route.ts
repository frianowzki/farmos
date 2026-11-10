import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { bad, readJson, requireProfile } from "@/lib/server/guard";
import { clean, diaryInput } from "@/lib/server/validate";
import { ownedProjectIds } from "@/lib/server/owned";

export async function GET() {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const entries = await db().select().from(schema.diaryEntries).where(eq(schema.diaryEntries.profileId, pid)).orderBy(desc(schema.diaryEntries.day), desc(schema.diaryEntries.createdAt));
  return NextResponse.json({ entries });
}

export async function POST(req: Request) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const parsed = diaryInput.safeParse(await readJson(req));
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "invalid");
  const v = clean(parsed.data);
  if (!v.day) return bad("day required");
  const [row] = await db().insert(schema.diaryEntries).values({ ...v, day: v.day, projectIds: await ownedProjectIds(pid, v.projectIds), profileId: pid }).returning();
  return NextResponse.json({ entry: row }, { status: 201 });
}
