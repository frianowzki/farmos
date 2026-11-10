/** Address families farmOS can watch. Aptos and Sui share the 0x + 64-hex shape, so they need a hint. */
export type WalletFamily = "evm" | "solana" | "aptos" | "sui" | "zcash";

export const FAMILY_LABEL: Record<WalletFamily, string> = { evm: "EVM", solana: "Solana", aptos: "Aptos", sui: "Sui", zcash: "Zcash" };
/** Chain-logo key for each family (EVM shows its own per-chain logos). */
export const FAMILY_CHAIN: Record<WalletFamily, string> = { evm: "ethereum", solana: "solana", aptos: "aptos", sui: "sui", zcash: "zcash" };

const EVM_RE = /^0x[a-fA-F0-9]{40}$/;
const MOVE_RE = /^0x[a-fA-F0-9]{1,64}$/;
const SOL_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const ZEC_T_RE = /^t[13][1-9A-HJ-NP-Za-km-z]{33}$/;
const ZEC_SHIELDED_RE = /^(zs1[0-9a-z]{70,}|u1[0-9a-z]{100,})$/;

/** Wallet apps that only live on one non-EVM family. */
const PROVIDER_FAMILY: Record<string, WalletFamily> = { petra: "aptos", martian: "aptos", slush: "sui", solflare: "solana", zashi: "zcash", ywallet: "zcash" };

export const isZcashShielded = (a: string) => ZEC_SHIELDED_RE.test(a);

/** Families an address could belong to, most likely first. */
export function familiesFor(address: string): WalletFamily[] {
  const a = address.trim();
  if (EVM_RE.test(a)) return ["evm"];
  if (ZEC_T_RE.test(a) || ZEC_SHIELDED_RE.test(a)) return ["zcash"];
  if (MOVE_RE.test(a)) return ["aptos", "sui"];
  if (SOL_RE.test(a)) return ["solana"];
  return [];
}

/** Resolve a wallet's family from its stored chain, its provider, then its shape. */
export function walletFamily(w: { address: string; chain?: string | null; provider?: string | null }): WalletFamily | null {
  const opts = familiesFor(w.address);
  if (w.chain && opts.includes(w.chain as WalletFamily)) return w.chain as WalletFamily;
  const p = w.provider ? PROVIDER_FAMILY[w.provider] : undefined;
  if (p && opts.includes(p)) return p;
  return opts[0] ?? null;
}

/** Canonical form used for de-duplication: EVM lowercase, Move addresses padded to 64 hex. */
export function normalizeAddress(address: string, family: WalletFamily | null): string {
  const a = address.trim();
  if (family === "evm") return a;
  if (family === "aptos" || family === "sui") return `0x${a.slice(2).toLowerCase().padStart(64, "0")}`;
  return a;
}
