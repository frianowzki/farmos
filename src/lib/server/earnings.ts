import "server-only";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Earning } from "@/db/schema";
import { getPrices } from "./prices";

export type EarningRow = Earning & { priceUsd: number | null; currentUsd: number | null };

/** A profile's earnings with live USD value (amount × current price) where a CoinGecko id is set. */
export async function earningsWithValue(pid: string): Promise<EarningRow[]> {
  const rows = await db().select().from(schema.earnings).where(eq(schema.earnings.profileId, pid)).orderBy(desc(schema.earnings.claimedAt), desc(schema.earnings.createdAt));
  const ids = rows.map((r) => r.coinId).filter((x): x is string => Boolean(x));
  const px = ids.length ? await getPrices(ids).catch(() => ({}) as Record<string, { usd: number }>) : {};
  return rows.map((r) => {
    const p = r.coinId ? (px as Record<string, { usd: number }>)[r.coinId]?.usd ?? null : null;
    return { ...r, priceUsd: p, currentUsd: p != null ? p * r.amount : null };
  });
}
