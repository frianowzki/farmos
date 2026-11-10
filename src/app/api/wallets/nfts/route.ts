import { NextResponse } from "next/server";
import { bad, requireProfile } from "@/lib/server/guard";
import { getNfts } from "@/lib/server/nfts";

export const maxDuration = 60;

/** NFTs held by saved wallets with collection floor prices (cached 30 min). POST forces a refresh. */
export async function GET() {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  try {
    return NextResponse.json(await getNfts(pid, false));
  } catch (e) {
    return bad((e as Error).message, 502);
  }
}

export async function POST() {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  try {
    return NextResponse.json(await getNfts(pid, true));
  } catch (e) {
    return bad((e as Error).message, 502);
  }
}
