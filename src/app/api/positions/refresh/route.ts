import { and, eq, isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { readJson, requireProfile } from "@/lib/server/guard";

/** Refresh current prices of open positions that have a token address, via DexScreener (public). */
export async function POST(req: Request) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const { projectId } = await readJson<{ projectId?: string }>(req);
  const where = projectId
    ? and(eq(schema.positions.profileId, pid), eq(schema.positions.status, "open"), isNotNull(schema.positions.tokenAddress), eq(schema.positions.projectId, projectId))
    : and(eq(schema.positions.profileId, pid), eq(schema.positions.status, "open"), isNotNull(schema.positions.tokenAddress));
  const rows = await db().select().from(schema.positions).where(where);
  const addrs = [...new Set(rows.map((r) => r.tokenAddress!.trim()).filter(Boolean))];
  const prices = new Map<string, number>();
  for (let i = 0; i < addrs.length; i += 30) {
    const chunk = addrs.slice(i, i + 30);
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${chunk.join(",")}`, { cache: "no-store" });
      const j = (await res.json()) as { pairs?: { baseToken: { address: string }; priceUsd?: string; liquidity?: { usd?: number } }[] };
      const best = new Map<string, { p: number; liq: number }>();
      for (const p of j.pairs ?? []) {
        const a = p.baseToken.address.toLowerCase();
        const price = Number(p.priceUsd);
        const liq = p.liquidity?.usd ?? 0;
        if (!Number.isFinite(price)) continue;
        if (!best.has(a) || best.get(a)!.liq < liq) best.set(a, { p: price, liq });
      }
      for (const [a, v] of best) prices.set(a, v.p);
    } catch {
      /* skip chunk */
    }
  }
  let updated = 0;
  for (const r of rows) {
    const p = prices.get(r.tokenAddress!.trim().toLowerCase());
    if (p == null) continue;
    await db().update(schema.positions).set({ currentPrice: p, priceUpdatedAt: new Date() }).where(and(eq(schema.positions.profileId, pid), eq(schema.positions.id, r.id)));
    updated++;
  }
  return NextResponse.json({ checked: rows.length, updated });
}
