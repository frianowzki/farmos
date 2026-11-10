/**
 * The only chains farmOS offers (project chains, wallet tracking, selectors).
 * Logos are the chains' official marks, self-hosted in /public/chains (96px webp).
 * Sources: Trust Wallet assets (official submissions), DefiLlama chain icons, and the chain's official X avatar (Elysium).
 */
export type ChainMeta = { key: string; name: string; aliases: string[]; evm: boolean };

export const CHAINS: ChainMeta[] = [
  { key: "ethereum", name: "Ethereum", aliases: ["eth", "mainnet", "ethereum mainnet"], evm: true },
  { key: "base", name: "Base", aliases: [], evm: true },
  { key: "robinhood", name: "Robinhood Chain", aliases: ["robinhood", "robinhoodchain", "rh chain"], evm: true },
  { key: "ink", name: "Ink", aliases: ["inkchain", "ink chain"], evm: true },
  { key: "bsc", name: "BSC", aliases: ["bnb", "bnb chain", "bnbchain", "bnb smart chain", "binance smart chain", "binance"], evm: true },
  { key: "hyperevm", name: "HyperEVM", aliases: ["hyperliquid", "hype evm", "hype", "hyperliquid evm", "hl"], evm: true },
  { key: "elysium", name: "Elysium", aliases: ["elysium l2", "kinetiq elysium"], evm: true },
  { key: "solana", name: "Solana", aliases: ["sol"], evm: false },
  { key: "zcash", name: "Zcash", aliases: ["zec"], evm: false },
  { key: "monero", name: "Monero", aliases: ["xmr"], evm: false },
  { key: "aptos", name: "Aptos", aliases: ["apt"], evm: false },
  { key: "sui", name: "Sui", aliases: [], evm: false },
  { key: "arbitrum", name: "Arbitrum", aliases: ["arb", "arbitrum one"], evm: true },
  { key: "optimism", name: "Optimism", aliases: ["op", "op mainnet"], evm: true },
  { key: "avalanche", name: "Avalanche", aliases: ["avax", "avalanche c-chain", "c-chain"], evm: true },
];

export const CHAIN_NAMES = CHAINS.map((c) => c.name);

const norm = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, " ").trim();

/** Find a supported chain by key, name or alias (case/space-insensitive). */
export function chainMeta(q: string | null | undefined): ChainMeta | undefined {
  if (!q) return undefined;
  const s = norm(q);
  const compact = s.replace(/\s/g, "");
  return CHAINS.find((c) => c.key === compact || norm(c.name) === s || norm(c.name).replace(/\s/g, "") === compact || c.aliases.some((a) => norm(a) === s || a.replace(/\s/g, "") === compact));
}

/** Canonical display name for a chain, or null if farmOS doesn't support it. */
export const canonicalChain = (q: string) => chainMeta(q)?.name ?? null;

/** Split a free-form chain list into supported (canonical, de-duped) and unsupported names. */
export function splitChains(list: string[]) {
  const keep: string[] = [];
  const drop: string[] = [];
  for (const raw of list) {
    const c = canonicalChain(raw);
    if (c) {
      if (!keep.includes(c)) keep.push(c);
    } else if (raw.trim()) drop.push(raw.trim());
  }
  return { keep, drop };
}

export const chainLogo = (key: string) => `/chains/${key}.webp`;
