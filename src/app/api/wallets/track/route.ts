import { NextResponse } from "next/server";
import { bad, requireSession } from "@/lib/server/guard";
import { getTrack } from "@/lib/server/wallet-track";

export const maxDuration = 60;

/** Cached (10 min) read-only balances for linked EVM wallets. POST forces a refresh. */
export async function GET() {
  const denied = await requireSession();
  if (denied) return denied;
  try {
    return NextResponse.json(await getTrack(false));
  } catch (e) {
    return bad((e as Error).message, 502);
  }
}

export async function POST() {
  const denied = await requireSession();
  if (denied) return denied;
  try {
    return NextResponse.json(await getTrack(true));
  } catch (e) {
    return bad((e as Error).message, 502);
  }
}
