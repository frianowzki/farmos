import { NextResponse } from "next/server";
import { timingSafeEqual } from "@/lib/session";
import { checkClaims, checkWatchlist } from "@/lib/server/alerts";
import { PROFILE_IDS } from "@/lib/profiles";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Second daily Vercel Cron (12:00 UTC = 19:00 WIB / 20:00 PHT): claim watches + watchlist price alerts.
 * Together with /api/cron/daily the checks run twice a day (Hobby allows one run per cron job per day).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !timingSafeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const out: Record<string, Record<string, unknown>> = {};
  for (const pid of PROFILE_IDS) {
    out[pid] = {};
    for (const [k, fn] of [["claims", checkClaims], ["watchlist", checkWatchlist]] as const) {
      try {
        out[pid][k] = await fn(pid);
      } catch (e) {
        out[pid][k] = { ok: false, error: (e as Error).message.slice(0, 160) };
      }
    }
  }
  return NextResponse.json(out);
}
