import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireProfile } from "@/lib/server/guard";

export async function GET() {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const rows = await db().select().from(schema.feedItems).where(eq(schema.feedItems.profileId, pid)).orderBy(desc(schema.feedItems.day), desc(schema.feedItems.score)).limit(60);
  return NextResponse.json({ items: rows });
}
