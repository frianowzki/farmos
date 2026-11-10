import { NextResponse } from "next/server";
import { timingSafeEqual } from "@/lib/session";
import { snapshotToBlob } from "@/lib/server/backup";
import { sendDigest } from "@/lib/server/telegram";
import { getTrack } from "@/lib/server/wallet-track";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Vercel Cron, daily 00:00 UTC (07:00 WIB): backup snapshot, wallet refresh, Telegram digest. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !timingSafeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const out: Record<string, unknown> = {};
  try {
    const b = await snapshotToBlob();
    out.backup = { ok: true, pathname: b.pathname, pruned: b.pruned };
  } catch (e) {
    out.backup = { ok: false, error: (e as Error).message.slice(0, 160) };
  }
  try {
    const t = await getTrack(true);
    out.wallets = { ok: true, count: t.wallets.length };
  } catch (e) {
    out.wallets = { ok: false, error: (e as Error).message.slice(0, 160) };
  }
  try {
    out.digest = await sendDigest();
  } catch (e) {
    out.digest = { ok: false, error: (e as Error).message.slice(0, 160) };
  }
  return NextResponse.json(out);
}
