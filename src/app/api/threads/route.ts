import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { requireSession } from "@/lib/server/guard";

export async function GET() {
  const denied = await requireSession();
  if (denied) return denied;
  const threads = await db()
    .select({ id: schema.chatThreads.id, title: schema.chatThreads.title, mode: schema.chatThreads.mode, updatedAt: schema.chatThreads.updatedAt })
    .from(schema.chatThreads)
    .orderBy(desc(schema.chatThreads.updatedAt))
    .limit(100);
  return NextResponse.json({ threads });
}
