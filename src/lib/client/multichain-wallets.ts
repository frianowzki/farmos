"use client";
import { getWallets } from "@wallet-standard/app";
import type { Wallet, WalletAccount } from "@wallet-standard/base";
import { useSyncExternalStore } from "react";
import type { WalletFamily } from "@/lib/wallet-chains";

/**
 * Non-EVM wallets via the Wallet Standard (the discovery layer under Solana wallet-adapter,
 * @mysten/dapp-kit and the Aptos wallet adapter). farmOS only calls connect to read the address:
 * no signing feature is ever invoked, and it disconnects right after.
 */
export type MultiFamily = Exclude<WalletFamily, "evm" | "zcash" | "near" | "canton">;

export type KnownWallet = { brand: string; name: string; families: MultiFamily[]; url: string };
/** Wallets surfaced even when not installed (with their official download page). */
export const KNOWN_WALLETS: KnownWallet[] = [
  { brand: "phantom", name: "Phantom", families: ["solana", "sui"], url: "https://phantom.com/download" },
  { brand: "solflare", name: "Solflare", families: ["solana"], url: "https://solflare.com/download" },
  { brand: "okx", name: "OKX Wallet", families: ["solana", "aptos", "sui"], url: "https://web3.okx.com/download" },
  { brand: "petra", name: "Petra", families: ["aptos"], url: "https://petra.app" },
  { brand: "martian", name: "Martian", families: ["aptos", "sui"], url: "https://martianwallet.xyz" },
  { brand: "nightly", name: "Nightly", families: ["sui", "solana", "aptos"], url: "https://nightly.app/download" },
  { brand: "slush", name: "Slush", families: ["sui"], url: "https://slush.app" },
];

const PREFIX: Record<MultiFamily, string> = { solana: "solana:", aptos: "aptos:", sui: "sui:" };

export function walletFamilies(w: Wallet): MultiFamily[] {
  const fams = (Object.keys(PREFIX) as MultiFamily[]).filter((f) => w.chains.some((c) => c.startsWith(PREFIX[f])) || (f === "aptos" && "aptos:connect" in w.features));
  return fams;
}

export function brandOf(name: string): string {
  const s = name.toLowerCase();
  if (s.includes("sui wallet") || s.includes("slush")) return "slush";
  for (const k of KNOWN_WALLETS) if (s.includes(k.brand) || s.includes(k.name.toLowerCase())) return k.brand;
  return "";
}

let snapshot: readonly Wallet[] = [];
function subscribe(cb: () => void) {
  const api = getWallets();
  snapshot = api.get();
  const update = () => {
    snapshot = api.get();
    cb();
  };
  const offs = [api.on("register", update), api.on("unregister", update)];
  update();
  return () => offs.forEach((o) => o());
}

/** Installed Wallet Standard wallets that speak Solana, Aptos or Sui. */
export function useStandardWallets(): readonly Wallet[] {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}

type AptosConnect = { connect: () => Promise<{ status: string; args?: { address: { toString(): string } | string } }> };
type StdConnect = { connect: (input?: { silent?: boolean }) => Promise<{ accounts: readonly WalletAccount[] }> };
type StdDisconnect = { disconnect: () => Promise<void> };

/** Ask the wallet for its address on one family. Read-only: connect + disconnect only. */
export async function connectAddress(w: Wallet, family: MultiFamily): Promise<string> {
  const f = w.features as Record<string, unknown>;
  let address: string | undefined;
  if (family === "aptos" && f["aptos:connect"]) {
    const r = await (f["aptos:connect"] as AptosConnect).connect();
    if (r.status !== "Approved" || !r.args) throw new Error("Connection rejected in the wallet");
    address = r.args.address.toString();
  } else if (f["standard:connect"]) {
    const { accounts } = await (f["standard:connect"] as StdConnect).connect();
    const acc = accounts.find((a) => a.chains.some((c) => c.startsWith(PREFIX[family]))) ?? accounts[0];
    address = acc?.address;
  }
  await (f["standard:disconnect"] as StdDisconnect | undefined)?.disconnect().catch(() => {});
  if (!address) throw new Error("The wallet returned no address");
  return address;
}

/** Legacy injected Aptos wallets that predate the standard (Martian, older Petra builds). */
export async function connectLegacyAptos(brand: "petra" | "martian"): Promise<string | null> {
  const g = window as unknown as Record<string, { connect?: () => Promise<{ address?: string }>; disconnect?: () => Promise<void> } | undefined>;
  const p = brand === "petra" ? g.aptos ?? g.petra : g.martian;
  if (!p?.connect) return null;
  const r = await p.connect();
  await p.disconnect?.().catch(() => {});
  return r?.address ?? null;
}

export const hasLegacyAptos = (brand: string) =>
  typeof window !== "undefined" && Boolean(brand === "martian" ? (window as unknown as { martian?: unknown }).martian : brand === "petra" ? (window as unknown as { aptos?: unknown; petra?: unknown }).aptos ?? (window as unknown as { petra?: unknown }).petra : null);
