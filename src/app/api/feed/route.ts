import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireSession } from "@/lib/server/guard";

export async function GET() {
  const denied = await requireSession();
  if (denied) return denied;
  const rows = await db().select().from(schema.feedItems).orderBy(desc(schema.feedItems.day), desc(schema.feedItems.score)).limit(60);
  return NextResponse.json({ items: rows });
}
