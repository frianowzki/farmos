import { NextResponse } from "next/server";
import { timingSafeEqual } from "@/lib/session";
import { snapshotToBlob } from "@/lib/server/backup";
import { sendDigest } from "@/lib/server/telegram";
import { getTrack } from "@/lib/server/wallet-track";
import { PROFILE_IDS } from "@/lib/profiles";
import { checkClaims } from "@/lib/server/alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Vercel Cron, daily 00:00 UTC (07:00 WIB / 08:00 PHT): backup, wallet refresh, claim alerts, Telegram digest. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !timingSafeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const all: Record<string, Record<string, unknown>> = {};
  // Each profile gets its own snapshot, wallet refresh and digest (to its own linked chat).
  for (const pid of PROFILE_IDS) all[pid] = await runFor(pid);
  return NextResponse.json(all);
}

async function runFor(pid: (typeof PROFILE_IDS)[number]) {
  const out: Record<string, unknown> = {};
  try {
    const b = await snapshotToBlob(pid);
    out.backup = { ok: true, pathname: b.pathname, pruned: b.pruned };
  } catch (e) {
    out.backup = { ok: false, error: (e as Error).message.slice(0, 160) };
  }
  try {
    const t = await getTrack(pid, true);
    out.wallets = { ok: true, count: t.wallets.length };
  } catch (e) {
    out.wallets = { ok: false, error: (e as Error).message.slice(0, 160) };
  }
  try {
    out.claims = await checkClaims(pid);
  } catch (e) {
    out.claims = { ok: false, error: (e as Error).message.slice(0, 160) };
  }
  try {
    out.digest = await sendDigest(pid);
  } catch (e) {
    out.digest = { ok: false, error: (e as Error).message.slice(0, 160) };
  }
  return out;
}
