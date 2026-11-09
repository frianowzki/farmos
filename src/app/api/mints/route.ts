import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { requireSession } from "@/lib/server/guard";
import { listDrops, openseaConfigured } from "@/lib/server/opensea";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  const watch = await db().select().from(schema.mintWatch);
  if (!openseaConfigured()) return NextResponse.json({ configured: false, drops: [], watch });
  const type = new URL(req.url).searchParams.get("type");
  try {
    const drops = await listDrops(type === "featured" || type === "recently_minted" ? type : "upcoming");
    return NextResponse.json({ configured: true, drops, watch });
  } catch (e) {
    return NextResponse.json({ configured: true, drops: [], watch, error: (e as Error).message });
  }
}
