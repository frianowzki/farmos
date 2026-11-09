import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { bad, readJson, requireSession } from "@/lib/server/guard";
import { clean, diaryInput } from "@/lib/server/validate";

export async function GET() {
  const denied = await requireSession();
  if (denied) return denied;
  const entries = await db().select().from(schema.diaryEntries).orderBy(desc(schema.diaryEntries.day), desc(schema.diaryEntries.createdAt));
  return NextResponse.json({ entries });
}

export async function POST(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  const parsed = diaryInput.safeParse(await readJson(req));
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "invalid");
  const v = clean(parsed.data);
  if (!v.day) return bad("day required");
  const [row] = await db().insert(schema.diaryEntries).values({ ...v, day: v.day }).returning();
  return NextResponse.json({ entry: row }, { status: 201 });
}
