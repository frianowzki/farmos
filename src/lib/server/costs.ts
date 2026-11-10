import "server-only";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Cost } from "@/db/schema";
import { getPrices } from "./prices";

export type CostRow = Cost & { priceUsd: number | null; currentUsd: number | null };

/** A profile's cost ledger with live USD value (amount × current price) where a CoinGecko id is set. */
export async function costsWithValue(pid: string): Promise<CostRow[]> {
  const rows = await db().select().from(schema.costs).where(eq(schema.costs.profileId, pid)).orderBy(desc(schema.costs.spentAt), desc(schema.costs.createdAt));
  const ids = [...new Set(rows.map((r) => r.coinId).filter((x): x is string => Boolean(x)))];
  const px = ids.length ? await getPrices(ids).catch(() => ({}) as Record<string, { usd: number }>) : {};
  return rows.map((r) => {
    const p = r.coinId ? (px as Record<string, { usd: number }>)[r.coinId]?.usd ?? null : null;
    return { ...r, priceUsd: p, currentUsd: p != null ? p * r.amount : null };
  });
}
