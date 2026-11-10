import { arbitrum, avalanche, base, bsc, hyperEvm, ink, mainnet, optimism, robinhood } from "viem/chains";
import { defineChain, type Chain } from "viem";
import { chainMeta } from "./chain-meta";

/** Elysium: Kinetiq's L2 for Hyperliquid (mainnet Nov 9 2026). Chain id 99901, gas token HYPE. */
export const elysium = defineChain({
  id: 99901,
  name: "Elysium",
  nativeCurrency: { name: "HYPE", symbol: "HYPE", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.elysium.kinetiq.xyz"] } },
  blockExplorers: { default: { name: "Elysium Explorer", url: "https://elysium.kinetiq.xyz" } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
});

/** Public RPC overrides for chains whose viem default is flaky. */
export const RPC_OVERRIDES: Record<number, string> = {
  1: "https://ethereum-rpc.publicnode.com",
  56: "https://bsc-rpc.publicnode.com",
};

/** EVM chains farmOS reads (subset of lib/chain-meta CHAINS; keys match chain-meta keys). */
export const EVM_CHAINS: { key: string; name: string; chain: Chain }[] = [
  { key: "ethereum", name: "Ethereum", chain: mainnet },
  { key: "base", name: "Base", chain: base },
  { key: "robinhood", name: "Robinhood Chain", chain: robinhood },
  { key: "ink", name: "Ink", chain: ink },
  { key: "bsc", name: "BSC", chain: bsc },
  { key: "hyperevm", name: "HyperEVM", chain: hyperEvm },
  { key: "elysium", name: "Elysium", chain: elysium },
  { key: "arbitrum", name: "Arbitrum", chain: arbitrum },
  { key: "optimism", name: "Optimism", chain: optimism },
  { key: "avalanche", name: "Avalanche", chain: avalanche },
];

/** Chains shown on the Wallets page and in RainbowKit. */
export const WALLET_CHAIN_KEYS = EVM_CHAINS.map((c) => c.key);

export function rpcFor(chain: Chain) {
  return RPC_OVERRIDES[chain.id] ?? chain.rpcUrls.default.http[0];
}

/** Resolve an EVM chain by key, name, alias (bnb, eth, hyperliquid…) or chain id. */
export function findChain(q: string | number) {
  const s = String(q).trim();
  const byId = EVM_CHAINS.find((c) => String(c.chain.id) === s);
  if (byId) return byId;
  const m = chainMeta(s);
  return m ? EVM_CHAINS.find((c) => c.key === m.key) : undefined;
}
