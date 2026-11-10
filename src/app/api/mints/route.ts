import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { requireProfile } from "@/lib/server/guard";
import { listDropsRich, openseaConfigured } from "@/lib/server/opensea";

export const maxDuration = 60;

export const dynamic = "force-dynamic";

export async function GET() {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const watch = await db().select().from(schema.mintWatch).where(eq(schema.mintWatch.profileId, pid));
  if (!openseaConfigured()) return NextResponse.json({ configured: false, drops: [], watch });
  try {
    const drops = await listDropsRich();
    return NextResponse.json({ configured: true, drops, watch });
  } catch (e) {
    return NextResponse.json({ configured: true, drops: [], watch, error: (e as Error).message });
  }
}
