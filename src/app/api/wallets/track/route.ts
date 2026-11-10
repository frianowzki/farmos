import { NextResponse } from "next/server";
import { bad, requireProfile } from "@/lib/server/guard";
import { getTrack } from "@/lib/server/wallet-track";

export const maxDuration = 60;

/** Cached (10 min) read-only balances for linked EVM wallets. POST forces a refresh. */
export async function GET() {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  try {
    return NextResponse.json(await getTrack(pid, false));
  } catch (e) {
    return bad((e as Error).message, 502);
  }
}

export async function POST() {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  try {
    return NextResponse.json(await getTrack(pid, true));
  } catch (e) {
    return bad((e as Error).message, 502);
  }
}
