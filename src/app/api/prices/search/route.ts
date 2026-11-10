import { NextResponse } from "next/server";
import { requireSession } from "@/lib/server/guard";
import { searchCoins } from "@/lib/server/prices";

export const dynamic = "force-dynamic";

/** GET /api/prices/search?q=eth → CoinGecko coin matches (popular coins when q is empty). */
export async function GET(req: Request) {
  const g = await requireSession();
  if (g) return g;
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return NextResponse.json({ coins: await searchCoins(q) });
}
