import { NextResponse } from "next/server";
import { requireSession } from "@/lib/server/guard";
import { getPrices, validCoinId } from "@/lib/server/prices";

export const dynamic = "force-dynamic";

/** GET /api/prices?ids=bitcoin,ethereum → { prices: { id: { usd, idr, php, usdt, change24h, at, stale?, source } } } */
export async function GET(req: Request) {
  const g = await requireSession();
  if (g) return g;
  const ids = (new URL(req.url).searchParams.get("ids") ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(validCoinId).slice(0, 60);
  if (!ids.length) return NextResponse.json({ prices: {} });
  return NextResponse.json({ prices: await getPrices(ids) }, { headers: { "cache-control": "no-store" } });
}
