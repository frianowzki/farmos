/** Address families farmOS can watch. Aptos and Sui share the 0x + 64-hex shape, so they need a hint. */
export type WalletFamily = "evm" | "solana" | "aptos" | "sui" | "zcash" | "near" | "canton";

export const FAMILY_LABEL: Record<WalletFamily, string> = { evm: "EVM", solana: "Solana", aptos: "Aptos", sui: "Sui", zcash: "Zcash", near: "NEAR", canton: "Canton" };
/** Chain-logo key for each family (EVM shows its own per-chain logos). */
export const FAMILY_CHAIN: Record<WalletFamily, string> = { evm: "ethereum", solana: "solana", aptos: "aptos", sui: "sui", zcash: "zcash", near: "near", canton: "canton" };
/** Families whose balances have no public read API: saved as watch-only (explorer link instead). */
export const WATCH_ONLY: WalletFamily[] = ["canton"];

const EVM_RE = /^0x[a-fA-F0-9]{40}$/;
const MOVE_RE = /^0x[a-fA-F0-9]{1,64}$/;
const SOL_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const ZEC_T_RE = /^t[13][1-9A-HJ-NP-Za-km-z]{33}$/;
const ZEC_SHIELDED_RE = /^(zs1[0-9a-z]{70,}|u1[0-9a-z]{100,})$/;
/** NEAR implicit account (64 hex, no 0x) or a named account under .near / .tg. */
const NEAR_IMPLICIT_RE = /^[0-9a-f]{64}$/;
const NEAR_NAMED_RE = /^(?=.{2,64}$)(([a-z0-9]+[-_])*[a-z0-9]+\.)+(near|tg)$/;
/** Canton party id: hint::1220 + 64-hex fingerprint. */
const CANTON_RE = /^[A-Za-z0-9._\-:]{1,185}::1220[0-9a-f]{64}$/;

/** Wallet apps that only live on one non-EVM family. */
const PROVIDER_FAMILY: Record<string, WalletFamily> = { petra: "aptos", martian: "aptos", slush: "sui", solflare: "solana", zashi: "zcash", ywallet: "zcash" };

export const isZcashShielded = (a: string) => ZEC_SHIELDED_RE.test(a);

/** Families an address could belong to, most likely first. */
export function familiesFor(address: string): WalletFamily[] {
  const a = address.trim();
  if (EVM_RE.test(a)) return ["evm"];
  if (CANTON_RE.test(a)) return ["canton"];
  if (NEAR_IMPLICIT_RE.test(a) || NEAR_NAMED_RE.test(a.toLowerCase())) return ["near"];
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
  if (family === "near") return a.toLowerCase();
  if (family === "aptos" || family === "sui") return `0x${a.slice(2).toLowerCase().padStart(64, "0")}`;
  return a;
}
