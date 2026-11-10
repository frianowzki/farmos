import "server-only";
import { and, eq, isNotNull } from "drizzle-orm";
import { createPublicClient, erc20Abi, formatUnits, getAddress, http, isAddress, type Address } from "viem";
import { db, schema } from "@/db";
import { EVM_CHAINS, findChain, rpcFor } from "@/lib/chains";
import { getSetting, setSetting } from "./settings";
import { isZcashShielded, walletFamily } from "@/lib/wallet-chains";

/** Main tokens tracked per chain (besides native). Decimals are read on-chain. */
const TOKENS: Record<string, { symbol: string; address: Address; cg?: string }[]> = {
  ethereum: [
    { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
    { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7" },
    { symbol: "WETH", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", cg: "ethereum" },
  ],
  base: [
    { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
    { symbol: "WETH", address: "0x4200000000000000000000000000000000000006", cg: "ethereum" },
  ],
  arbitrum: [
    { symbol: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" },
    { symbol: "USDT", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9" },
    { symbol: "WETH", address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", cg: "ethereum" },
    { symbol: "ARB", address: "0x912CE59144191C1204E64559FE8253a0e49E6548", cg: "arbitrum" },
  ],
  optimism: [
    { symbol: "USDC", address: "0x0b2C639c533813f4Aa9D7837cAf62653d097Ff85" },
    { symbol: "USDT", address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58" },
    { symbol: "WETH", address: "0x4200000000000000000000000000000000000006", cg: "ethereum" },
    { symbol: "OP", address: "0x4200000000000000000000000000000000000042", cg: "optimism" },
  ],
  bsc: [
    { symbol: "USDT", address: "0x55d398326f99059fF775485246999027B3197955" },
    { symbol: "USDC", address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d" },
  ],
  avalanche: [
    { symbol: "USDC", address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E" },
    { symbol: "USDT", address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7" },
  ],
  ink: [{ symbol: "WETH", address: "0x4200000000000000000000000000000000000006", cg: "ethereum" }],
  hyperevm: [],
  robinhood: [],
  elysium: [],
  // Arc's USDC ERC-20 interface mirrors the native balance, so only the native read counts (no double count).
  arc: [],
};

/** CoinGecko ids for native gas tokens. */
const NATIVE_CG: Record<string, string> = {
  ethereum: "ethereum", base: "ethereum", arbitrum: "ethereum", optimism: "ethereum", ink: "ethereum", robinhood: "ethereum",
  bsc: "binancecoin", avalanche: "avalanche-2", hyperevm: "hyperliquid", elysium: "hyperliquid", arc: "usd-coin",
};
const STABLES = new Set(["USDC", "USDT"]);
export const TRACK_CHAINS = Object.keys(TOKENS);
const TTL_MS = 10 * 60_000;

export type Holding = { chain: string; symbol: string; token: string | null; amount: number; usd: number | null };
export type WalletTrack = { address: string; label: string; holdings: Holding[]; totalUsd: number; errors: string[] };
export type PositionTrack = {
  positionId: string; projectId: string; projectName: string; token: string; chain: string; tokenAddress: string;
  recordedSize: number; onchainSize: number; entryPrice: number; currentPrice: number | null;
  costBasis: number; value: number | null; pnl: number | null;
};
export type TrackSnapshot = { fetchedAt: string; wallets: WalletTrack[]; positions: PositionTrack[]; totalUsd: number; sources: Record<string, "etherscan" | "rpc">; priceSource: string };

const clients = new Map<string, ReturnType<typeof createPublicClient>>();
function client(key: string) {
  if (!clients.has(key)) {
    const c = findChain(key)!;
    clients.set(key, createPublicClient({ chain: c.chain, transport: http(rpcFor(c.chain), { timeout: 12_000, batch: true }) }));
  }
  return clients.get(key)!;
}

let esQueue: Promise<void> = Promise.resolve();
/** Etherscan free tier allows 3 req/s: serialize calls ~380 ms apart. */
function esThrottle() {
  const p = esQueue.then(() => new Promise<void>((r) => setTimeout(r, 380)));
  esQueue = p;
  return p;
}

/** Native balances via Etherscan V2 balancemulti (≤20 addrs); null if the chain is not on the plan. */
async function etherscanNative(chainId: number, addrs: Address[]): Promise<Map<string, bigint> | null> {
  const key = process.env.ETHERSCAN_API_KEY;
  if (!key) return null;
  const out = new Map<string, bigint>();
  for (let i = 0; i < addrs.length; i += 20) {
    await esThrottle();
    const u = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=balancemulti&tag=latest&address=${addrs.slice(i, i + 20).join(",")}&apikey=${key}`;
    const j = (await fetch(u, { cache: "no-store", signal: AbortSignal.timeout(12_000) }).then((r) => r.json()).catch(() => null)) as { status?: string; result?: { account: string; balance: string }[] | string } | null;
    if (!j || j.status !== "1" || !Array.isArray(j.result)) return null;
    for (const r of j.result) out.set(r.account.toLowerCase(), BigInt(r.balance));
  }
  return out;
}

async function prices(ids: string[]): Promise<Record<string, number>> {
  if (!ids.length) return {};
  try {
    const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${[...new Set(ids)].join(",")}&vs_currencies=usd`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    const j = (await r.json()) as Record<string, { usd?: number }>;
    return Object.fromEntries(Object.entries(j).filter(([, v]) => typeof v?.usd === "number").map(([k, v]) => [k, v.usd!]));
  } catch {
    return {};
  }
}

const SOL_RPC = "https://solana-rpc.publicnode.com";
const SOL_STABLES: Record<string, string> = { EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC", Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: "USDT" };
const post = (url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(12_000) }).then((r) => r.json());

type Bal = { symbol: string; amount: number; cg?: string; stable?: boolean; token?: string | null };

/** SOL + USDC/USDT (SPL) over public RPC. */
async function solanaBalances(addr: string): Promise<Bal[]> {
  // SPL lookups are "indexed" calls publicnode refuses without a token; Solana's public RPC serves them.
  const [n, ...toks] = await Promise.all([
    post(SOL_RPC, { jsonrpc: "2.0", id: 1, method: "getBalance", params: [addr, { commitment: "confirmed" }] }),
    ...Object.keys(SOL_STABLES).map((mint) =>
      post("https://api.mainnet-beta.solana.com", { jsonrpc: "2.0", id: 2, method: "getTokenAccountsByOwner", params: [addr, { mint }, { encoding: "jsonParsed", commitment: "confirmed" }] }).catch(() => null),
    ),
  ]);
  if (typeof n?.result?.value !== "number") throw new Error(n?.error?.message ?? "RPC error");
  const out: Bal[] = [{ symbol: "SOL", amount: n.result.value / 1e9, cg: "solana" }];
  for (const t of toks)
    for (const acc of t?.result?.value ?? []) {
      const info = acc?.account?.data?.parsed?.info;
      const sym = SOL_STABLES[info?.mint];
      const amt = Number(info?.tokenAmount?.uiAmount ?? 0);
      if (sym && amt > 0) out.push({ symbol: sym, amount: amt, stable: true, token: info.mint });
    }
  return out;
}

/** APT over the Aptos Labs fullnode (works for coin and fungible-asset balances). */
async function aptosBalances(addr: string): Promise<Bal[]> {
  const r = await fetch(`https://api.mainnet.aptoslabs.com/v1/accounts/${addr}/balance/0x1::aptos_coin::AptosCoin`, { cache: "no-store", signal: AbortSignal.timeout(12_000) });
  if (r.status === 404) return [];
  if (!r.ok) throw new Error(`fullnode ${r.status}`);
  return [{ symbol: "APT", amount: Number(await r.text()) / 1e8, cg: "aptos" }];
}

const SUI_COINS: Record<string, { symbol: string; dec: number; cg?: string; stable?: boolean }> = {
  "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI": { symbol: "SUI", dec: 9, cg: "sui" },
  "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC": { symbol: "USDC", dec: 6, stable: true },
};
/** SUI + native USDC over Sui's public GraphQL (JSON-RPC on public fullnodes is retired). */
async function suiBalances(addr: string): Promise<Bal[]> {
  const j = await post("https://graphql.mainnet.sui.io/graphql", { query: `{ address(address: "${addr}") { balances(first: 50) { nodes { coinType { repr } totalBalance } } } }` });
  if (j?.errors?.length) throw new Error(j.errors[0].message);
  const out: Bal[] = [];
  for (const b of j?.data?.address?.balances?.nodes ?? []) {
    const c = SUI_COINS[b.coinType?.repr];
    const amt = c ? Number(b.totalBalance) / 10 ** c.dec : 0;
    if (c && amt > 0) out.push({ symbol: c.symbol, amount: amt, cg: c.cg, stable: c.stable, token: c.symbol === "SUI" ? null : b.coinType.repr });
  }
  return out;
}

/** Transparent ZEC via public explorers (3xpl, then Blockchair). Shielded addresses can't be read without a viewing key. */
async function zcashBalances(addr: string): Promise<Bal[]> {
  if (isZcashShielded(addr)) throw new Error("shielded address: balance is private (needs a viewing key)");
  const x = await fetch(`https://sandbox-api.3xpl.com/zcash/address/${addr}?data=balances&from=all`, { cache: "no-store", signal: AbortSignal.timeout(12_000) }).then((r) => r.json()).catch(() => null);
  let zat: number | null = x?.data?.balances?.["zcash-main"]?.zcash?.balance != null ? Number(x.data.balances["zcash-main"].zcash.balance) : x?.context?.code === 200 ? 0 : null;
  if (zat == null) {
    const b = await fetch(`https://api.blockchair.com/zcash/dashboards/address/${addr}`, { cache: "no-store", signal: AbortSignal.timeout(12_000) }).then((r) => r.json()).catch(() => null);
    const v = b?.data?.[addr]?.address?.balance;
    zat = typeof v === "number" ? v : null;
  }
  if (zat == null) throw new Error("explorer unavailable");
  return [{ symbol: "ZEC", amount: zat / 1e8, cg: "zcash" }];
}

const NEAR_RPCS = ["https://free.rpc.fastnear.com", "https://rpc.mainnet.near.org"];
const NEAR_FT: { symbol: string; contract: string; dec: number }[] = [
  { symbol: "USDC", contract: "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1", dec: 6 },
  { symbol: "USDT", contract: "usdt.tether-token.near", dec: 6 },
];
async function nearQuery(params: Record<string, unknown>) {
  let last: unknown = null;
  for (const url of NEAR_RPCS) {
    const j = await post(url, { jsonrpc: "2.0", id: 1, method: "query", params: { finality: "final", ...params } }).catch((e) => ({ error: { message: (e as Error).message } }));
    if (j?.result) return j.result;
    last = j?.error;
    // unknown account is a real answer, not an RPC failure
    if (JSON.stringify(j?.error ?? "").includes("UNKNOWN_ACCOUNT") || JSON.stringify(j?.error ?? "").includes("does not exist")) return null;
  }
  throw new Error((last as { message?: string })?.message ?? "NEAR RPC error");
}
/** NEAR + native USDC/USDT (NEP-141) over public NEAR RPC (FastNEAR, then near.org). */
async function nearBalances(addr: string): Promise<Bal[]> {
  const acct = await nearQuery({ request_type: "view_account", account_id: addr });
  if (!acct) return [];
  const out: Bal[] = [{ symbol: "NEAR", amount: Number(BigInt(acct.amount) / BigInt(1e18)) / 1e6, cg: "near" }];
  const args = Buffer.from(JSON.stringify({ account_id: addr })).toString("base64");
  await Promise.all(
    NEAR_FT.map(async (t) => {
      const r = await nearQuery({ request_type: "call_function", account_id: t.contract, method_name: "ft_balance_of", args_base64: args }).catch(() => null);
      if (!r?.result) return;
      const raw = JSON.parse(Buffer.from(r.result).toString()) as string;
      const amt = Number(raw) / 10 ** t.dec;
      if (amt > 0) out.push({ symbol: t.symbol, amount: amt, stable: true, token: t.contract });
    }),
  );
  return out;
}

const NON_EVM: Record<string, (a: string) => Promise<Bal[]>> = { solana: solanaBalances, aptos: aptosBalances, sui: suiBalances, zcash: zcashBalances, near: nearBalances };
const FAMILY_NAME: Record<string, string> = { solana: "Solana", aptos: "Aptos", sui: "Sui", zcash: "Zcash", near: "NEAR" };

export async function trackWallets(pid: string): Promise<TrackSnapshot> {
  const d = db();
  const all = await d.select().from(schema.wallets).where(eq(schema.wallets.profileId, pid));
  const other = all.map((w) => ({ w, fam: walletFamily(w) })).filter((x) => x.fam && x.fam !== "evm" && NON_EVM[x.fam]) as { w: (typeof all)[number]; fam: string }[];
  const wallets = all.filter((w) => isAddress(w.address));
  const addrs = wallets.map((w) => getAddress(w.address));
  const res = new Map<string, WalletTrack>(wallets.map((w) => [w.address.toLowerCase(), { address: w.address, label: w.label, holdings: [], totalUsd: 0, errors: [] }]));
  const sources: TrackSnapshot["sources"] = {};
  const raw: { addr: string; chain: string; symbol: string; token: string | null; amount: number; cg?: string; stable?: boolean }[] = [];

  await Promise.all(
    TRACK_CHAINS.map(async (ck) => {
      const meta = EVM_CHAINS.find((c) => c.key === ck)!;
      if (!addrs.length) return;
      // native: Etherscan first (sequential via throttle), RPC fallback for chains not on the free plan
      let native = await etherscanNative(meta.chain.id, addrs).catch(() => null);
      sources[ck] = native ? "etherscan" : "rpc";
      try {
        if (!native) {
          native = new Map();
          const bals = await Promise.all(addrs.map((a) => client(ck).getBalance({ address: a })));
          addrs.forEach((a, i) => native!.set(a.toLowerCase(), bals[i]));
        }
        for (const a of addrs) {
          const v = Number(formatUnits(native.get(a.toLowerCase()) ?? BigInt(0), meta.chain.nativeCurrency.decimals));
          if (v > 0) raw.push({ addr: a.toLowerCase(), chain: ck, symbol: meta.chain.nativeCurrency.symbol, token: null, amount: v, cg: NATIVE_CG[ck], stable: STABLES.has(meta.chain.nativeCurrency.symbol) });
        }
      } catch (e) {
        for (const a of addrs) res.get(a.toLowerCase())!.errors.push(`${meta.name}: ${(e as Error).message.slice(0, 60)}`);
      }
      const toks = TOKENS[ck];
      if (!toks.length) return;
      try {
        const calls = toks.flatMap((t) => [
          { address: t.address, abi: erc20Abi, functionName: "decimals" as const },
          ...addrs.map((a) => ({ address: t.address, abi: erc20Abi, functionName: "balanceOf" as const, args: [a] as const })),
        ]);
        const out = await client(ck).multicall({ contracts: calls, allowFailure: true });
        let i = 0;
        for (const t of toks) {
          const dec = out[i++];
          for (const a of addrs) {
            const b = out[i++];
            if (dec.status !== "success" || b.status !== "success") continue;
            const v = Number(formatUnits(b.result as bigint, Number(dec.result)));
            if (v > 0) raw.push({ addr: a.toLowerCase(), chain: ck, symbol: t.symbol, token: t.address, amount: v, cg: t.cg, stable: STABLES.has(t.symbol) });
          }
        }
      } catch (e) {
        for (const a of addrs) res.get(a.toLowerCase())!.errors.push(`${meta.name} tokens: ${(e as Error).message.slice(0, 60)}`);
      }
    }),
  );

  for (const { w } of other) res.set(w.address, { address: w.address, label: w.label, holdings: [], totalUsd: 0, errors: [] });
  await Promise.all(
    other.map(async ({ w, fam }) => {
      try {
        for (const b of await NON_EVM[fam](w.address)) if (b.amount > 0) raw.push({ addr: w.address, chain: fam, symbol: b.symbol, token: b.token ?? null, amount: b.amount, cg: b.cg, stable: b.stable });
        sources[fam] = "rpc";
      } catch (e) {
        res.get(w.address)!.errors.push(`${FAMILY_NAME[fam]}: ${(e as Error).message.slice(0, 80)}`);
      }
    }),
  );

  const px = await prices(raw.map((r) => r.cg).filter(Boolean) as string[]);
  for (const r of raw) {
    const usd = r.stable ? r.amount : r.cg && px[r.cg] != null ? r.amount * px[r.cg] : null;
    const w = res.get(r.addr)!;
    w.holdings.push({ chain: r.chain, symbol: r.symbol, token: r.token, amount: r.amount, usd });
    w.totalUsd += usd ?? 0;
  }
  for (const w of res.values()) w.holdings.sort((a, b) => (b.usd ?? 0) - (a.usd ?? 0));

  const positions = await trackPositions(pid, addrs);
  const list = [...res.values()];
  return { fetchedAt: new Date().toISOString(), wallets: list, positions, totalUsd: list.reduce((s, w) => s + w.totalUsd, 0), sources, priceSource: "CoinGecko (natives), stables at $1" };
}

/** Open positions with a token address on a known EVM chain: read on-chain size across linked wallets. */
async function trackPositions(pid: string, addrs: Address[]): Promise<PositionTrack[]> {
  if (!addrs.length) return [];
  const d = db();
  const rows = await d
    .select({ p: schema.positions, name: schema.projects.name })
    .from(schema.positions)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.positions.projectId))
    .where(and(eq(schema.positions.profileId, pid), eq(schema.projects.profileId, pid), eq(schema.positions.status, "open"), isNotNull(schema.positions.tokenAddress)));
  const out: PositionTrack[] = [];
  for (const { p, name } of rows) {
    const c = p.chain ? findChain(p.chain) : null;
    const ta = p.tokenAddress?.trim() ?? "";
    if (!c || !isAddress(ta)) continue;
    try {
      const calls = [
        { address: ta, abi: erc20Abi, functionName: "decimals" as const },
        ...addrs.map((a) => ({ address: ta, abi: erc20Abi, functionName: "balanceOf" as const, args: [a] as const })),
      ];
      const r = await client(c.key).multicall({ contracts: calls, allowFailure: true });
      if (r[0].status !== "success") continue;
      const dec = Number(r[0].result);
      const size = r.slice(1).reduce((s, x) => s + (x.status === "success" ? Number(formatUnits(x.result as bigint, dec)) : 0), 0);
      const cost = size * (p.entryPrice || 0);
      const value = p.currentPrice != null ? size * p.currentPrice : null;
      out.push({
        positionId: p.id, projectId: p.projectId, projectName: name, token: p.token, chain: c.key, tokenAddress: ta,
        recordedSize: p.size, onchainSize: size, entryPrice: p.entryPrice, currentPrice: p.currentPrice,
        costBasis: cost, value, pnl: value != null && p.entryPrice > 0 ? value - cost : null,
      });
    } catch {
      /* chain RPC failure: skip this position */
    }
  }
  return out;
}

export async function getTrack(pid: string, force = false): Promise<TrackSnapshot & { cached: boolean }> {
  const cached = await getSetting<TrackSnapshot>(pid, "wallet_track");
  if (!force && cached && Date.now() - +new Date(cached.fetchedAt) < TTL_MS) {
    // invalidate when the set of linked wallets changed
    const now = (await db().select().from(schema.wallets).where(eq(schema.wallets.profileId, pid))).filter((w) => walletFamily(w)).map((w) => (isAddress(w.address) ? w.address.toLowerCase() : w.address)).sort().join();
    const was = cached.wallets.map((w) => (isAddress(w.address) ? w.address.toLowerCase() : w.address)).sort().join();
    if (now === was) return { ...cached, cached: true };
  }
  const snap = await trackWallets(pid);
  await setSetting(pid, "wallet_track", snap);
  return { ...snap, cached: false };
}

export async function getCachedTrack(pid: string) {
  return getSetting<TrackSnapshot>(pid, "wallet_track");
}
