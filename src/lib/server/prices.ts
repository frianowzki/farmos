import "server-only";
import { GLOBAL_PROFILE } from "@/lib/profiles";
import type { PriceQuote } from "@/lib/fiat";
import { getSetting, setSetting } from "./settings";

/**
 * Token prices in USD/IDR/PHP/USDT with three layers:
 *  1. in-memory (per instance, 60s), 2. shared DB cache in settings(_global, price_cache, 3 min fresh),
 *  3. live CoinGecko → fallback DefiLlama (USD) × open.er-api fiat rates → last known value marked stale.
 */
const FRESH_MS = 3 * 60_000;
const MEM_MS = 60_000;
const MAX_ENTRIES = 400;
const ID_RE = /^[a-z0-9][a-z0-9-]{0,80}$/;
const UA = { accept: "application/json", "user-agent": "farmOS/1.0" };

type Cache = Record<string, PriceQuote>;
let mem: { at: number; data: Cache } = { at: 0, data: {} };

export const validCoinId = (s: unknown): s is string => typeof s === "string" && ID_RE.test(s);

async function getJson<T>(url: string, ms = 9_000): Promise<T> {
  const headers: Record<string, string> = { ...UA };
  if (process.env.COINGECKO_API_KEY && url.includes("api.coingecko.com")) headers["x-cg-demo-api-key"] = process.env.COINGECKO_API_KEY;
  const r = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as T;
}

let fx: { at: number; idr: number; php: number } | null = null;
/** USD→IDR/PHP from a free FX feed (fallback path only), cached 6h. */
async function fiatRates() {
  if (fx && Date.now() - fx.at < 6 * 3600_000) return fx;
  const j = await getJson<{ rates?: Record<string, number> }>("https://open.er-api.com/v6/latest/USD");
  const idr = j.rates?.IDR, php = j.rates?.PHP;
  if (!idr || !php) throw new Error("FX rates missing");
  fx = { at: Date.now(), idr, php };
  return fx;
}

async function fromCoinGecko(ids: string[]): Promise<Cache> {
  const all = [...new Set([...ids, "tether"])];
  const j = await getJson<Record<string, { usd?: number; idr?: number; php?: number; usd_24h_change?: number }>>(
    `https://api.coingecko.com/api/v3/simple/price?ids=${all.join(",")}&vs_currencies=usd,idr,php&include_24hr_change=true`,
  );
  const tether = j.tether?.usd || 1;
  const at = new Date().toISOString();
  const out: Cache = {};
  for (const id of all) {
    const p = j[id];
    if (!p?.usd) continue;
    out[id] = { usd: p.usd, idr: p.idr ?? NaN, php: p.php ?? NaN, usdt: p.usd / tether, change24h: p.usd_24h_change ?? null, at, source: "coingecko" };
  }
  return out;
}

async function fromLlama(ids: string[]): Promise<Cache> {
  const keys = [...new Set([...ids, "tether"])].map((i) => `coingecko:${i}`);
  const [j, r] = await Promise.all([
    getJson<{ coins: Record<string, { price?: number }> }>(`https://coins.llama.fi/prices/current/${keys.join(",")}`),
    fiatRates(),
  ]);
  const tether = j.coins["coingecko:tether"]?.price || 1;
  const at = new Date().toISOString();
  const out: Cache = {};
  for (const id of ids) {
    const usd = j.coins[`coingecko:${id}`]?.price;
    if (!usd) continue;
    out[id] = { usd, idr: usd * r.idr, php: usd * r.php, usdt: usd / tether, change24h: null, at, source: "defillama" };
  }
  return out;
}

/** Prices for CoinGecko ids. Unknown ids are simply missing from the result. */
export async function getPrices(input: string[], opts: { force?: boolean } = {}): Promise<Record<string, PriceQuote>> {
  const ids = [...new Set(input.filter(validCoinId))].slice(0, 60);
  if (!ids.length) return {};
  const now = Date.now();
  const fresh = (q?: PriceQuote, ms = FRESH_MS) => Boolean(q && !q.stale && now - Date.parse(q.at) < ms && Number.isFinite(q.idr) && Number.isFinite(q.php));
  if (!opts.force && now - mem.at < MEM_MS && ids.every((i) => fresh(mem.data[i], MEM_MS))) return pick(mem.data, ids);
  const db = (await getSetting<Cache>(GLOBAL_PROFILE, "price_cache").catch(() => null)) ?? {};
  const missing = opts.force ? ids : ids.filter((i) => !fresh(db[i]));
  let got: Cache = {};
  if (missing.length) {
    try {
      got = await fromCoinGecko(missing);
    } catch {
      got = {};
    }
    // Fill anything CoinGecko didn't return (rate limit, outage, NaN fiat) from DefiLlama.
    const still = missing.filter((i) => !got[i] || !Number.isFinite(got[i].idr) || !Number.isFinite(got[i].php));
    if (still.length) {
      try {
        Object.assign(got, await fromLlama(still));
      } catch {
        /* keep stale values below */
      }
    }
  }
  const merged: Cache = { ...db, ...got };
  for (const i of missing) if (!got[i] && db[i]) merged[i] = { ...db[i], stale: true };
  if (Object.keys(got).length) {
    const trimmed = Object.fromEntries(Object.entries(merged).sort((a, b) => Date.parse(b[1].at) - Date.parse(a[1].at)).slice(0, MAX_ENTRIES).map(([k, v]) => [k, { ...v, stale: undefined }]));
    await setSetting(GLOBAL_PROFILE, "price_cache", trimmed).catch(() => null);
  }
  mem = { at: now, data: { ...mem.data, ...merged } };
  return pick(merged, ids);
}

function pick(c: Cache, ids: string[]) {
  return Object.fromEntries(ids.filter((i) => c[i]).map((i) => [i, c[i]]));
}

export type CoinHit = { id: string; name: string; symbol: string; thumb: string | null; rank: number | null };
const searchMem = new Map<string, { at: number; hits: CoinHit[] }>();
/** The converter's default list (in this order). Everything else is reached through search. */
const POPULAR: CoinHit[] = [
  ["bitcoin", "Bitcoin", "BTC"], ["ethereum", "Ethereum", "ETH"], ["tether", "Tether", "USDT"], ["usd-coin", "USDC", "USDC"], ["binancecoin", "BNB", "BNB"],
  ["solana", "Solana", "SOL"], ["zcash", "Zcash", "ZEC"], ["hyperliquid", "Hyperliquid", "HYPE"], ["monero", "Monero", "XMR"], ["sui", "Sui", "SUI"], ["aptos", "Aptos", "APT"],
].map(([id, name, symbol]) => ({ id, name, symbol, thumb: null, rank: null }));

let topMem: { at: number; hits: CoinHit[] } | null = null;
/** The default list with logos and ranks from CoinGecko (cached 10 min); the static list if CoinGecko is down. */
async function popular(): Promise<CoinHit[]> {
  if (topMem && Date.now() - topMem.at < 10 * 60_000) return topMem.hits;
  try {
    const ids = POPULAR.map((c) => c.id).join(",");
    const j = await getJson<{ id: string; image?: string; market_cap_rank?: number | null }[]>(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&per_page=50&page=1&sparkline=false`);
    const by = new Map(j.map((c) => [c.id, c]));
    const hits = POPULAR.map((c) => ({ ...c, thumb: by.get(c.id)?.image ?? null, rank: by.get(c.id)?.market_cap_rank ?? null }));
    if (j.length) topMem = { at: Date.now(), hits };
    return hits;
  } catch {
    return topMem?.hits ?? POPULAR;
  }
}

/** CoinGecko search, cached 10 min per query. Empty query → popular coins. */
export async function searchCoins(q: string): Promise<CoinHit[]> {
  const query = q.trim().toLowerCase().slice(0, 60);
  if (!query) return popular();
  const hit = searchMem.get(query);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.hits;
  try {
    const j = await getJson<{ coins?: { id: string; name: string; symbol: string; thumb?: string; market_cap_rank?: number | null }[] }>(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`);
    const hits = (j.coins ?? []).slice(0, 15).map((c) => ({ id: c.id, name: c.name, symbol: c.symbol.toUpperCase(), thumb: c.thumb ?? null, rank: c.market_cap_rank ?? null }));
    searchMem.set(query, { at: Date.now(), hits });
    if (searchMem.size > 300) searchMem.delete(searchMem.keys().next().value!);
    return hits;
  } catch {
    // Offline fallback: match the popular list so the converter still works.
    return POPULAR.filter((c) => c.id.includes(query) || c.symbol.toLowerCase().includes(query) || c.name.toLowerCase().includes(query));
  }
}

/** Coin metadata (name/symbol/image) for a CoinGecko id, used when adding to the watchlist. */
export async function coinMeta(id: string): Promise<{ id: string; name: string; symbol: string; image: string | null } | null> {
  if (!validCoinId(id)) return null;
  try {
    const j = await getJson<{ id: string; name: string; symbol: string; image?: { small?: string } }>(
      `https://api.coingecko.com/api/v3/coins/${id}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`,
    );
    return { id: j.id, name: j.name, symbol: j.symbol.toUpperCase(), image: j.image?.small ?? null };
  } catch {
    const p = await getPrices([id]);
    return p[id] ? { id, name: id, symbol: id.toUpperCase().slice(0, 10), image: null } : null;
  }
}
