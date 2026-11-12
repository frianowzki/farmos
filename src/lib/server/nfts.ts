import "server-only";
import { eq } from "drizzle-orm";
import { isAddress } from "viem";
import { db, schema } from "@/db";
import { walletFamily } from "@/lib/wallet-chains";
import { getSetting, setSetting } from "./settings";

/** NFTs held by saved wallets, via OpenSea (read-only, API key server-side), valued at each collection's floor. */
const API = "https://api.opensea.io/api/v2";

/**
 * Chains we scan for NFTs, in the order most holdings turn up. Slugs are OpenSea's own chain
 * identifiers (/api/v2/chain/<slug>/...). Keep this list deliberate: each chain costs one lookup
 * per wallet plus a stats call per collection, and OpenSea's key allows 4 requests/second.
 */
const EVM_CHAINS = [
  "ethereum",
  "base",
  "arbitrum",
  "optimism",
  "bsc",
  "robinhood",
  "ink",
  "hyperevm",
  "arc",
  "elysium",
];

/** OpenSea's free tier is 4 requests/second. Keep headroom below it. */
const MIN_GAP_MS = 280;
const TTL_MS = 30 * 60_000;
const CG: Record<string, string> = { ETH: "ethereum", WETH: "ethereum", BNB: "binancecoin", WBNB: "binancecoin", POL: "polygon-ecosystem-token", MATIC: "polygon-ecosystem-token", AVAX: "avalanche-2", APE: "apecoin", SOL: "solana", HYPE: "hyperliquid", SEI: "sei-network", RON: "ronin", FLOW: "flow", BERA: "berachain-bera", MON: "monad" };

type OsNft = { identifier: string; collection: string; name: string | null; image_url: string | null; display_image_url?: string | null; opensea_url: string; is_disabled?: boolean; is_nsfw?: boolean };

/** `valued` separates "we know this collection is worthless" from "we never got a price". */
export type NftCollection = { slug: string; name: string; image: string | null; chain: string; count: number; floor: number | null; symbol: string | null; usd: number | null; volume?: number; offers?: boolean; url: string; wallets: string[]; valued: boolean; sample: { name: string | null; image: string | null; url: string }[] };
export type NftSnapshot = { fetchedAt: string; collections: NftCollection[]; count: number; totalUsd: number | null; totalNative: { symbol: string; amount: number }[]; errors: string[]; configured: boolean; chains: string[]; hidden?: number; unscanned?: number };

/**
 * Every OpenSea call is serialised through one queue so the whole scan shares a single rate
 * budget. Without this `pool()` fired six lookups at once and OpenSea answered 429 for most.
 */
let gate: Promise<void> = Promise.resolve();
let lastCall = 0;

function throttle<T>(fn: () => Promise<T>): Promise<T> {
  const slot = gate.then(async () => {
    const wait = MIN_GAP_MS - (Date.now() - lastCall);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
  });
  gate = slot.catch(() => {});
  return slot.then(fn);
}

class RateLimited extends Error {}

async function os<T>(path: string): Promise<T> {
  return throttle(async () => {
    const r = await fetch(`${API}${path}`, { headers: { "x-api-key": process.env.OPENSEA_API_KEY!.trim(), accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (r.status === 429) throw new RateLimited("OpenSea rate limit");
    if (!r.ok) throw new Error(`OpenSea ${r.status}`);
    return r.json() as Promise<T>;
  });
}

/** One retry after a pause on 429; anything else fails fast so a real error stays visible. */
async function osRetry<T>(path: string): Promise<T> {
  try {
    return await os<T>(path);
  } catch (e) {
    if (!(e instanceof RateLimited)) throw e;
    await new Promise((r) => setTimeout(r, 1400));
    return os<T>(path);
  }
}

async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) await fn(items[i++]); }));
}

async function nftsFor(chain: string, address: string): Promise<OsNft[]> {
  const out: OsNft[] = [];
  let next: string | undefined;
  for (let p = 0; p < 5; p++) {
    const j = await osRetry<{ nfts?: OsNft[]; next?: string }>(`/chain/${chain}/account/${address}/nfts?limit=200${next ? `&next=${encodeURIComponent(next)}` : ""}`);
    out.push(...(j.nfts ?? []));
    next = j.next;
    if (!next) break;
  }
  return out;
}

export async function scanNfts(pid: string): Promise<NftSnapshot> {
  if (!process.env.OPENSEA_API_KEY?.trim()) return { fetchedAt: new Date().toISOString(), collections: [], count: 0, totalUsd: null, totalNative: [], errors: [], configured: false, chains: [] };

  const wallets = await db().select().from(schema.wallets).where(eq(schema.wallets.profileId, pid));
  const jobs: { chain: string; address: string; label: string }[] = [];
  for (const w of wallets) {
    const f = walletFamily(w);
    if (f === "evm" && isAddress(w.address)) for (const c of EVM_CHAINS) jobs.push({ chain: c, address: w.address, label: w.label || w.address.slice(0, 6) });
    if (f === "solana") jobs.push({ chain: "solana", address: w.address, label: w.label || w.address.slice(0, 4) });
  }

  const cols = new Map<string, NftCollection>();
  const errors: string[] = [];
  /** Chains whose holdings lookup failed: their absence is unknown, not zero. */
  const failedChains = new Set<string>();

  await pool(jobs, 3, async (j) => {
    try {
      for (const n of await nftsFor(j.chain, j.address)) {
        if (n.is_disabled) continue;
        const c = cols.get(n.collection) ?? { slug: n.collection, name: n.collection, image: null, chain: j.chain, count: 0, floor: null, symbol: null, usd: null, url: `https://opensea.io/collection/${n.collection}`, wallets: [], valued: false, sample: [] };
        c.count++;
        if (!c.wallets.includes(j.label)) c.wallets.push(j.label);
        if (c.sample.length < 3) c.sample.push({ name: n.name, image: n.display_image_url ?? n.image_url, url: n.opensea_url });
        cols.set(n.collection, c);
      }
    } catch (e) {
      failedChains.add(j.chain);
      const msg = `${j.chain}: ${(e as Error).message}`;
      if (!errors.includes(msg)) errors.push(msg);
    }
  });

  await pool([...cols.values()], 3, async (c) => {
    const [stats, info] = await Promise.all([
      osRetry<{ total?: { floor_price?: number; floor_price_symbol?: string; volume?: number } }>(`/collections/${encodeURIComponent(c.slug)}/stats`).catch(() => null),
      osRetry<{ name?: string; image_url?: string }>(`/collections/${encodeURIComponent(c.slug)}`).catch(() => null),
    ]);
    if (info?.name) c.name = info.name;
    c.image = info?.image_url || c.sample[0]?.image || null;
    const fp = stats?.total?.floor_price;
    if (typeof fp === "number" && fp > 0) {
      c.floor = fp;
      c.symbol = stats?.total?.floor_price_symbol || "ETH";
    }
    c.volume = typeof stats?.total?.volume === "number" ? stats.total.volume : 0;
    // Only a stats response we actually received licenses calling a collection dead.
    c.valued = stats != null;
    if (c.floor == null && !c.volume) {
      const offers = await osRetry<{ offers?: unknown[] }>(`/offers/collection/${encodeURIComponent(c.slug)}?limit=1`).catch(() => null);
      c.offers = Boolean(offers?.offers?.length);
      if (offers != null) c.valued = true;
    } else c.offers = true;
  });

  // Hide genuinely dead collections (spam airdrops) — never one whose pricing call failed,
  // otherwise a rate limit turns into "this NFT is worthless" and the count reads short.
  let hidden = 0;
  for (const [k, c] of cols) {
    if (c.valued && c.floor == null && !c.volume && !c.offers) { cols.delete(k); hidden += c.count; }
  }

  const ids = [...new Set([...cols.values()].map((c) => (c.symbol ? CG[c.symbol.toUpperCase()] : undefined)).filter(Boolean) as string[])];
  let px: Record<string, { usd?: number }> = {};
  if (ids.length) px = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd`, { cache: "no-store", signal: AbortSignal.timeout(10_000) }).then((r) => r.json()).catch(() => ({}));

  const native = new Map<string, number>();
  let totalUsd: number | null = null;
  for (const c of cols.values()) {
    if (c.floor == null || !c.symbol) continue;
    const sym = c.symbol.toUpperCase() === "WETH" ? "ETH" : c.symbol.toUpperCase();
    native.set(sym, (native.get(sym) ?? 0) + c.floor * c.count);
    const p = px[CG[c.symbol.toUpperCase()] ?? ""]?.usd;
    if (typeof p === "number") {
      c.usd = c.floor * c.count * p;
      totalUsd = (totalUsd ?? 0) + c.usd;
    }
  }
  const collections = [...cols.values()].sort((a, b) => (b.usd ?? -1) - (a.usd ?? -1) || b.count - a.count);
  return {
    fetchedAt: new Date().toISOString(),
    collections,
    count: collections.reduce((s, c) => s + c.count, 0),
    totalUsd,
    totalNative: [...native].map(([symbol, amount]) => ({ symbol, amount })).sort((a, b) => b.amount - a.amount),
    errors,
    configured: true,
    chains: [...new Set(jobs.map((j) => j.chain))],
    hidden,
    unscanned: failedChains.size || undefined,
  };
}

/** Bump when the scan shape changes so a stale cached snapshot is not served after a deploy. */
const CACHE_VERSION = "v4";

export async function getNfts(pid: string, force = false): Promise<NftSnapshot & { cached: boolean }> {
  const cached = await getSetting<NftSnapshot & { key?: string }>(pid, "wallet_nfts");
  const key = CACHE_VERSION + "|" + (await db().select({ a: schema.wallets.address }).from(schema.wallets).where(eq(schema.wallets.profileId, pid))).map((w) => w.a.toLowerCase()).sort().join();
  if (!force && cached?.fetchedAt && cached.key === key && Date.now() - +new Date(cached.fetchedAt) < TTL_MS) return { ...cached, cached: true };
  const snap = await scanNfts(pid);
  await setSetting(pid, "wallet_nfts", { ...snap, key });
  return { ...snap, cached: false };
}
