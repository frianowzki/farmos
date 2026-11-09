import { abstract, arbitrum, avalanche, base, berachain, blast, bsc, hyperEvm, ink, linea, mainnet, mantle, monad, optimism, polygon, scroll, sonic, unichain, zksync, zora } from "viem/chains";
import type { Chain } from "viem";

/** Public RPC overrides for chains whose viem default is flaky. */
export const RPC_OVERRIDES: Record<number, string> = {
  1: "https://ethereum-rpc.publicnode.com",
  56: "https://bsc-rpc.publicnode.com",
  137: "https://polygon-bor-rpc.publicnode.com",
};

export const EVM_CHAINS: { key: string; name: string; chain: Chain }[] = [
  { key: "ethereum", name: "Ethereum", chain: mainnet },
  { key: "base", name: "Base", chain: base },
  { key: "arbitrum", name: "Arbitrum", chain: arbitrum },
  { key: "optimism", name: "Optimism", chain: optimism },
  { key: "bnb", name: "BNB", chain: bsc },
  { key: "polygon", name: "Polygon", chain: polygon },
  { key: "linea", name: "Linea", chain: linea },
  { key: "scroll", name: "Scroll", chain: scroll },
  { key: "blast", name: "Blast", chain: blast },
  { key: "zksync", name: "zkSync", chain: zksync },
  { key: "ink", name: "Ink", chain: ink },
  { key: "unichain", name: "Unichain", chain: unichain },
  { key: "sonic", name: "Sonic", chain: sonic },
  { key: "berachain", name: "Berachain", chain: berachain },
  { key: "abstract", name: "Abstract", chain: abstract },
  { key: "avalanche", name: "Avalanche", chain: avalanche },
  { key: "hyperevm", name: "HyperEVM", chain: hyperEvm },
  { key: "monad", name: "Monad", chain: monad },
  { key: "mantle", name: "Mantle", chain: mantle },
  { key: "zora", name: "Zora", chain: zora },
];

/** Chains shown on the Wallets page and in RainbowKit. */
export const WALLET_CHAIN_KEYS = ["ethereum", "base", "arbitrum", "optimism", "bnb", "polygon", "ink", "linea", "hyperevm"];

export function rpcFor(chain: Chain) {
  return RPC_OVERRIDES[chain.id] ?? chain.rpcUrls.default.http[0];
}

export function findChain(q: string | number) {
  const s = String(q).toLowerCase().replace(/\s+/g, "");
  return EVM_CHAINS.find((c) => c.key === s || c.name.toLowerCase().replace(/\s+/g, "") === s || String(c.chain.id) === s || (s === "bsc" && c.key === "bnb") || (s === "eth" && c.key === "ethereum") || (s === "mainnet" && c.key === "ethereum"));
}
