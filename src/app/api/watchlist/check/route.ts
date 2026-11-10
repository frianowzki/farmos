import { NextResponse } from "next/server";
import { checkWatchlist } from "@/lib/server/alerts";
import { requireProfile } from "@/lib/server/guard";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Run this profile's price alerts now (same check the cron runs). */
export async function POST() {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  return NextResponse.json(await checkWatchlist(pid));
}
