"use client";
import type { WalletSelector } from "@near-wallet-selector/core";

/**
 * NEAR wallets via @near-wallet-selector (loaded on demand). farmOS signs in WITHOUT a contractId,
 * so no function-call access key is created: it only reads the accountId and signs out right away.
 * Nothing is ever signed or sent.
 */
export type NearWalletInfo = { id: string; brand: string; name: string; icon: string; type: string; available: boolean; url: string };

const BRAND: Record<string, { brand: string; url: string }> = {
  "meteor-wallet": { brand: "meteor", url: "https://meteorwallet.app" },
  "hot-wallet": { brand: "hot", url: "https://hot-labs.org/wallet" },
  "my-near-wallet": { brand: "mynearwallet", url: "https://app.mynearwallet.com" },
  nightly: { brand: "nightly", url: "https://nightly.app/download" },
  sender: { brand: "sender", url: "https://sender.org" },
  "intear-wallet": { brand: "intear", url: "https://wallet.intear.tech" },
};

let sel: Promise<WalletSelector> | null = null;
export function nearSelector() {
  sel ??= (async () => {
    const [{ setupWalletSelector }, meteor, hot, mnw, nightly, sender, intear] = await Promise.all([
      import("@near-wallet-selector/core"),
      import("@near-wallet-selector/meteor-wallet"),
      import("@near-wallet-selector/hot-wallet"),
      import("@near-wallet-selector/my-near-wallet"),
      import("@near-wallet-selector/nightly"),
      import("@near-wallet-selector/sender"),
      import("@near-wallet-selector/intear-wallet"),
    ]);
    return setupWalletSelector({
      network: "mainnet",
      modules: [meteor.setupMeteorWallet(), hot.setupHotWallet(), mnw.setupMyNearWallet(), nightly.setupNightly(), sender.setupSender(), intear.setupIntearWallet()],
    });
  })().catch((e) => {
    sel = null;
    throw e;
  });
  return sel;
}

export async function nearWallets(): Promise<NearWalletInfo[]> {
  const s = await nearSelector();
  return s.store
    .getState()
    .modules.filter((m) => BRAND[m.id] && !m.metadata.deprecated)
    .map((m) => ({ id: m.id, brand: BRAND[m.id].brand, name: m.metadata.name, icon: m.metadata.iconUrl, type: m.type, available: m.metadata.available, url: BRAND[m.id].url }));
}

/** Read the accountId from one wallet, then sign out. Browser (redirect) wallets return via /wallets?near=1. */
export async function connectNear(id: string): Promise<string | null> {
  const s = await nearSelector();
  const w = await s.wallet(id);
  const params = { accounts: [], successUrl: `${location.origin}/wallets?near=1`, failureUrl: `${location.origin}/wallets?near=0` };
  const accounts = await (w.signIn as (p: typeof params) => Promise<{ accountId: string }[]>)(params);
  const acc = accounts?.[0]?.accountId ?? s.store.getState().accounts[0]?.accountId ?? null;
  await w.signOut().catch(() => {});
  return acc;
}

/** After a redirect wallet (MyNearWallet) returns: pick up the account it signed in, then sign out. */
export async function pendingNearAccount(): Promise<{ accountId: string; walletId: string | null } | null> {
  const s = await nearSelector();
  const st = s.store.getState();
  const accountId = st.accounts[0]?.accountId;
  if (!accountId) return null;
  const walletId = st.selectedWalletId;
  if (walletId) await (await s.wallet(walletId)).signOut().catch(() => {});
  return { accountId, walletId };
}

export const nearBrand = (walletId: string | null) => (walletId && BRAND[walletId]?.brand) || "";
