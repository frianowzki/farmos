import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { requireSession } from "@/lib/server/guard";
import { listDropsRich, openseaConfigured } from "@/lib/server/opensea";

export const maxDuration = 60;

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireSession();
  if (denied) return denied;
  const watch = await db().select().from(schema.mintWatch);
  if (!openseaConfigured()) return NextResponse.json({ configured: false, drops: [], watch });
  try {
    const drops = await listDropsRich();
    return NextResponse.json({ configured: true, drops, watch });
  } catch (e) {
    return NextResponse.json({ configured: true, drops: [], watch, error: (e as Error).message });
  }
}
