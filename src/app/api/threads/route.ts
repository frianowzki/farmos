import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { requireProfile } from "@/lib/server/guard";

export async function GET() {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const threads = await db()
    .select({ id: schema.chatThreads.id, title: schema.chatThreads.title, mode: schema.chatThreads.mode, updatedAt: schema.chatThreads.updatedAt })
    .from(schema.chatThreads)
    .where(eq(schema.chatThreads.profileId, pid))
    .orderBy(desc(schema.chatThreads.updatedAt))
    .limit(100);
  return NextResponse.json({ threads });
}

/** Clear all chat history of the signed-in profile (never another profile's). */
export async function DELETE() {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const gone = await db().delete(schema.chatThreads).where(eq(schema.chatThreads.profileId, pid)).returning({ id: schema.chatThreads.id });
  return NextResponse.json({ ok: true, deleted: gone.length });
}
