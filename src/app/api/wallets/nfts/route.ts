import { NextResponse } from "next/server";
import { bad, requireSession } from "@/lib/server/guard";
import { getNfts } from "@/lib/server/nfts";

export const maxDuration = 60;

/** NFTs held by saved wallets with collection floor prices (cached 30 min). POST forces a refresh. */
export async function GET() {
  const denied = await requireSession();
  if (denied) return denied;
  try {
    return NextResponse.json(await getNfts(false));
  } catch (e) {
    return bad((e as Error).message, 502);
  }
}

export async function POST() {
  const denied = await requireSession();
  if (denied) return denied;
  try {
    return NextResponse.json(await getNfts(true));
  } catch (e) {
    return bad((e as Error).message, 502);
  }
}
