import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { bad, readJson, requireProfile } from "@/lib/server/guard";
import { coinMeta, getPrices } from "@/lib/server/prices";
import { watchInput } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

/** The profile's watchlist with live prices. */
export async function GET() {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const items = await db().select().from(schema.watchlist).where(eq(schema.watchlist.profileId, pid)).orderBy(asc(schema.watchlist.sortOrder), asc(schema.watchlist.createdAt));
  const prices = items.length ? await getPrices(items.map((i) => i.coinId)).catch(() => ({})) : {};
  return NextResponse.json({ items, prices });
}

/** Add a token by CoinGecko id (idempotent per profile). */
export async function POST(req: Request) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const parsed = watchInput.safeParse(await readJson(req));
  if (!parsed.success || !parsed.data.coinId) return bad(parsed.success ? "coinId is required" : parsed.error.issues[0]?.message ?? "invalid");
  const meta = await coinMeta(parsed.data.coinId);
  if (!meta) return bad("Token not found on CoinGecko", 404);
  const count = (await db().select({ id: schema.watchlist.id }).from(schema.watchlist).where(eq(schema.watchlist.profileId, pid))).length;
  if (count >= 100) return bad("Watchlist is full (100 tokens)");
  const [row] = await db()
    .insert(schema.watchlist)
    .values({ profileId: pid, coinId: meta.id, symbol: meta.symbol, name: meta.name, image: meta.image, above: parsed.data.above ?? null, below: parsed.data.below ?? null, alertCurrency: parsed.data.alertCurrency ?? "usd", sortOrder: count })
    .onConflictDoNothing()
    .returning();
  return NextResponse.json({ item: row ?? null, exists: !row }, { status: row ? 201 : 200 });
}
