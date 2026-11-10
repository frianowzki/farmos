"use client";
import { ProjectMark } from "@/components/project-mark";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Copy, ExternalLink, Link2, Plus, Star, Trash2, Unplug } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ChainLogo, ChainStack } from "@/components/chain-logo";
import { WalletIcon } from "@/components/wallet-icon";
import { ProviderPicker, WalletModal, type WalletModalView } from "@/components/wallet-forms";
import { brandFromConnector } from "@/lib/wallet-brands";
import { FAMILY_CHAIN, FAMILY_LABEL, WATCH_ONLY, walletFamily } from "@/lib/wallet-chains";
import { nearBrand, pendingNearAccount } from "@/lib/client/near-wallets";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "@/lib/client/toast";
import { formatUnits, isAddress } from "viem";
import { useAccount, useBalance, useDisconnect } from "wagmi";
import { Page, PageHeader } from "@/components/shell";
import { Button, InlineText, NativeSelect, SectionTitle, Skeleton } from "@/components/ui";
import { WalletProvider, walletConnectReady } from "@/components/wallet-provider";
import { WalletTracker } from "@/components/wallet-tracker";
import { cn } from "@/lib/cn";
import { EVM_CHAINS, WALLET_CHAIN_KEYS } from "@/lib/chains";
import { num, shortAddr, usd } from "@/lib/format";
import { api, keys, useProjects, useWallets, type Wallet } from "@/lib/client/api";
import { LayoutGroup, motion } from "motion/react";

const CHAINS = WALLET_CHAIN_KEYS.map((k) => EVM_CHAINS.find((c) => c.key === k)!);

const byDefault = (a: { isDefault?: boolean }, b: { isDefault?: boolean }) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault));

// Optimistic: flip the flag and move the new default to the top right away (lists animate), then persist.
async function setDefault(qc: ReturnType<typeof useQueryClient>, id: string, next: boolean) {
  const prev = qc.getQueryData<{ wallets: Wallet[] }>(keys.wallets);
  if (prev) {
    const ws = prev.wallets.map((x) => ({ ...x, isDefault: next ? x.id === id : x.id === id ? false : x.isDefault }));
    qc.setQueryData(keys.wallets, { ...prev, wallets: ws.sort(byDefault) });
  }
  try {
    await api(`/api/wallets/${id}`, { method: "PATCH", body: { isDefault: next } });
    toast.success(next ? "Set as default wallet" : "Default cleared");
  } catch (e) {
    if (prev) qc.setQueryData(keys.wallets, prev);
    toast.error((e as Error).message);
  } finally {
    qc.invalidateQueries({ queryKey: keys.wallets });
  }
}

export function WalletsView() {
  return (
    <WalletProvider>
      <Inner />
    </WalletProvider>
  );
}

function Inner() {
  const { address, isConnected, connector } = useAccount();
  const { disconnectAsync } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const { data, isLoading } = useWallets();
  const qc = useQueryClient();
  const linked = data?.wallets ?? [];
  const isLinked = address && linked.some((w) => w.address.toLowerCase() === address.toLowerCase());
  const provider = brandFromConnector(connector);
  const [modal, setModal] = useState<WalletModalView | null>(null);
  const def = linked.find((w) => w.isDefault);

  // Back from a redirect NEAR wallet (MyNearWallet): save the account it signed in, then clean the URL.
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (!q.has("near")) return;
    history.replaceState(null, "", "/wallets");
    if (q.get("near") !== "1") return void toast.error("NEAR sign-in cancelled");
    pendingNearAccount()
      .then(async (r) => {
        if (!r) return;
        await api("/api/wallets", { method: "POST", body: { address: r.accountId, label: "NEAR", provider: nearBrand(r.walletId), chain: "near" } });
        qc.invalidateQueries({ queryKey: keys.wallets });
        qc.invalidateQueries({ queryKey: ["wallet-track"] });
        toast.success(`${r.accountId} added`);
      })
      .catch((e) => toast.error((e as Error).message));
  }, [qc]);

  const add = async (a: string, l: string, prov: string) => {
    try {
      await api("/api/wallets", { method: "POST", body: { address: a, label: l, provider: prov } });
      qc.invalidateQueries({ queryKey: keys.wallets });
      qc.invalidateQueries({ queryKey: ["wallet-track"] });
      toast.success("Wallet linked");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  // Link more than one: drop the current connection and reopen the picker (switch account/app there).
  const connectAnother = async () => {
    await disconnectAsync().catch(() => {});
    setTimeout(() => openConnectModal?.(), 150);
  };

  return (
    <Page>
      <PageHeader title="Wallets" />

      {def ? (
        <motion.div layout className="mb-8 rounded-xl border border-line bg-panel p-4">
          <DefaultHero w={def} wallets={linked} onSwitch={(id) => setDefault(qc, id, true)} />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
            <div className="flex min-w-0 items-center gap-2 text-[12.5px] text-muted">
              {isConnected ? <><WalletIcon provider={provider} size={18} /><span className="truncate">Connected {shortAddr(address)} via {connector?.name ?? "wallet"}</span></> : <span>No browser wallet connected</span>}
            </div>
            <div className="flex items-center gap-2">
              {isConnected && address && !isLinked && <Button size="sm" variant="primary" onClick={() => add(address, connector?.name ?? "", provider)}><Link2 className="h-3.5 w-3.5" /> Link to farmOS</Button>}
              {isConnected ? <Button size="sm" variant="ghost" onClick={() => disconnectAsync()}><Unplug className="h-3.5 w-3.5" /> Disconnect</Button> : <Button size="sm" onClick={() => setModal("menu")}><Plus className="h-3.5 w-3.5" /> Connect wallet</Button>}
            </div>
          </div>
        </motion.div>
      ) : (
      <div className="mb-8 rounded-xl border border-line bg-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {isConnected ? (connector?.icon && !provider ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={connector.icon} alt={connector.name} className="h-9 w-9 rounded-[28%]" />
            ) : <WalletIcon provider={provider} size={36} />) : (
              <div className="flex items-center -space-x-2">
                {(["metamask", "rabby", "phantom", "coinbase"] as const).map((b) => <span key={b} className="rounded-[28%] ring-2 ring-panel"><WalletIcon provider={b} size={26} /></span>)}
              </div>
            )}
            <div>
              <div className="text-[14px] font-medium">{isConnected ? shortAddr(address) : "No wallet connected"}</div>
              <div className="text-[12.5px] text-muted">{isConnected ? `via ${connector?.name ?? "wallet"}` : walletConnectReady ? "Browser wallets and WalletConnect" : "Browser wallets (injected). WalletConnect needs a project id."}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isConnected && address && !isLinked && <Button size="sm" variant="primary" onClick={() => add(address, connector?.name ?? "", provider)}><Link2 className="h-3.5 w-3.5" /> Link to farmOS</Button>}
            {isConnected && isLinked && <Button size="sm" onClick={() => setModal("menu")}><Plus className="h-3.5 w-3.5" /> Add another wallet</Button>}
            {isConnected ? (
              <Button size="sm" variant="ghost" onClick={() => disconnectAsync()}><Unplug className="h-3.5 w-3.5" /> Disconnect</Button>
            ) : (
              <Button variant="primary" onClick={() => setModal("menu")}>Connect wallet</Button>
            )}
          </div>
        </div>
        {isConnected && address && <div className="mt-4 border-t border-line pt-4"><Balances address={address} /></div>}
      </div>
      )}

      <WalletTracker hasEvm={linked.length > 0} />

      <SectionTitle right={<Button size="sm" onClick={() => setModal("menu")}><Plus className="h-3.5 w-3.5" /> Add wallet</Button>}>Linked wallets</SectionTitle>
      {isLoading ? (
        <Skeleton className="h-24" />
      ) : linked.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-[13.5px] text-muted">Link your farming wallets to tag them on projects and check balances across chains.</div>
      ) : (
        <div className="divide-y divide-line rounded-lg border border-line bg-panel">
          <LayoutGroup>
            {[...linked].sort(byDefault).map((w) => (
              <motion.div key={w.id} layout="position" transition={{ type: "spring", stiffness: 420, damping: 36 }} className="bg-panel first:rounded-t-lg last:rounded-b-lg">
                <WalletRow w={w} />
              </motion.div>
            ))}
          </LayoutGroup>
        </div>
      )}
      <WalletModal view={modal} setView={setModal} onConnect={() => (isConnected ? connectAnother() : openConnectModal?.())} connectLabel={isConnected ? "Another EVM wallet" : "EVM wallet"} />
    </Page>
  );
}

type TrackSnap = { wallets: { address: string; holdings: { chain: string }[] }[] };

function WalletRow({ w }: { w: { id: string; address: string; label: string; provider: string; chain?: string; isDefault?: boolean } }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const track = useQuery({ queryKey: ["wallet-track"], queryFn: () => api<TrackSnap>("/api/wallets/track"), staleTime: 5 * 60_000 });
  const held = track.data?.wallets.find((x) => x.address.toLowerCase() === w.address.toLowerCase())?.holdings.map((h) => h.chain) ?? [];
  const { data } = useProjects();
  const used = (data?.projects ?? []).filter((p) => p.wallets.some((x) => x.toLowerCase() === w.address.toLowerCase()));
  const evm = isAddress(w.address);
  const fam = walletFamily(w);
  return (
    <div>
      <div className="group flex items-center gap-3 px-3 py-2">
        <button onClick={() => evm && setOpen((o) => !o)} className={cn("rounded p-0.5 text-faint", evm ? "hover:text-ink" : "opacity-30")} aria-label="Show balances">
          <ChevronDown className={cn("h-4 w-4 transition-transform", !open && "-rotate-90")} />
        </button>
        <ProviderPicker compact value={w.provider} onChange={async (v) => { await api(`/api/wallets/${w.id}`, { method: "PATCH", body: { provider: v } }); qc.invalidateQueries({ queryKey: keys.wallets }); }} />
        <div className="w-[150px] shrink-0">
          <InlineText value={w.label} placeholder="Add label" onSave={async (v) => { await api(`/api/wallets/${w.id}`, { method: "PATCH", body: { label: v } }); qc.invalidateQueries({ queryKey: keys.wallets }); }} />
        </div>
        <span className="num min-w-0 flex-1 truncate text-[12.5px] text-ink-2">{w.address}</span>
        {w.isDefault && <span className="hidden shrink-0 items-center sm:inline-flex gap-1 rounded-full bg-accent/10 px-1.5 py-0.5 text-[10.5px] font-medium text-accent"><Star className="h-2.5 w-2.5 fill-current" />Default</span>}
        {held.length > 0 ? <span className="hidden md:inline-flex"><ChainStack chains={held} size={16} max={5} /></span> : !evm && fam && <span className="hidden md:inline-flex"><ChainLogo chain={FAMILY_CHAIN[fam]} size={16} /></span>}
        <div className="hidden items-center gap-1 sm:flex">{used.slice(0, 3).map((p) => <Link key={p.id} href={`/projects/${p.id}`} title={p.name}><ProjectMark p={p} size={18} /></Link>)}{used.length > 3 && <span className="text-[11.5px] text-faint">+{used.length - 3}</span>}</div>
        <button onClick={() => { navigator.clipboard.writeText(w.address); toast.success("Copied"); }} className="rounded p-1 text-faint hover:text-ink" aria-label="Copy"><Copy className="h-3.5 w-3.5" /></button>
        {fam && WATCH_ONLY.includes(fam) && <span className="hidden shrink-0 rounded-full border border-line px-1.5 py-0.5 text-[10.5px] text-muted sm:inline">Watch-only</span>}
        <button
          onClick={() => setDefault(qc, w.id, !w.isDefault)}
          className={cn("rounded p-1 hover:text-ink", w.isDefault ? "text-accent" : "text-faint sm:opacity-0 sm:group-hover:opacity-100")}
          aria-label={w.isDefault ? "Clear default wallet" : "Set as default"}
          title={w.isDefault ? "Default wallet" : "Set as default"}
        >
          <Star className={cn("h-3.5 w-3.5", w.isDefault && "fill-current")} />
        </button>
        {(fam === "canton" || fam === "near") && <a href={fam === "canton" ? `https://ccscan.xyz/party/${encodeURIComponent(w.address)}` : `https://nearblocks.io/address/${w.address}`} target="_blank" rel="noreferrer" className="rounded p-1 text-faint hover:text-ink" aria-label="Open in explorer"><ExternalLink className="h-3.5 w-3.5" /></a>}
        {evm && <a href={`https://debank.com/profile/${w.address}`} target="_blank" rel="noreferrer" className="rounded p-1 text-faint hover:text-ink" aria-label="Open in DeBank"><ExternalLink className="h-3.5 w-3.5" /></a>}
        <button onClick={async () => { if (!confirm("Unlink this wallet?")) return; await api(`/api/wallets/${w.id}`, { method: "DELETE" }); qc.invalidateQueries({ queryKey: keys.wallets }); }} className="rounded p-1 text-faint opacity-0 hover:text-neg group-hover:opacity-100" aria-label="Unlink"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
      {open && evm && <div className="border-t border-line bg-bg/50 px-3 py-3"><Balances address={w.address as `0x${string}`} /></div>}
    </div>
  );
}

function Balances({ address }: { address: `0x${string}` }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {CHAINS.map((c) => <BalanceCell key={c.key} address={address} chainId={c.chain.id} name={c.name} chainKey={c.key} />)}
    </div>
  );
}

function BalanceCell({ address, chainId, name, chainKey }: { address: `0x${string}`; chainId: number; name: string; chainKey: string }) {
  const { data, isLoading, isError } = useBalance({ address, chainId, query: { staleTime: 60_000, retry: 1 } });
  const v = data ? Number(formatUnits(data.value, data.decimals)) : null;
  return (
    <div className="rounded-lg border border-line bg-panel px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11.5px] text-muted"><ChainLogo chain={chainKey} size={14} />{name}</div>
      <div className={cn("num text-[14px]", v === 0 && "text-faint")}>
        {isLoading ? <span className="text-faint">…</span> : isError ? <span className="text-[12px] text-faint">RPC error</span> : `${num(v, v && v < 1 ? 5 : 4)} ${data?.symbol ?? ""}`}
      </div>
    </div>
  );
}

function DefaultHero({ w, wallets, onSwitch }: { w: Wallet; wallets: Wallet[]; onSwitch: (id: string) => void }) {
  const fam = walletFamily(w);
  const evm = isAddress(w.address);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <WalletIcon provider={w.provider} size={36} />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-[14px] font-medium">{w.label || shortAddr(w.address)}</span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent/10 px-1.5 py-0.5 text-[10.5px] font-medium text-accent"><Star className="h-2.5 w-2.5 fill-current" />Default</span>
            </div>
            <div className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-muted">
              {fam && <ChainLogo chain={FAMILY_CHAIN[fam]} size={13} />}
              <span className="num truncate">{shortAddr(w.address)}</span>
              {fam && <span className="shrink-0">· {FAMILY_LABEL[fam]}</span>}
              <button onClick={() => { navigator.clipboard.writeText(w.address); toast.success("Copied"); }} className="rounded p-0.5 text-faint hover:text-ink" aria-label="Copy"><Copy className="h-3 w-3" /></button>
            </div>
          </div>
        </div>
        {wallets.length > 1 && (
          <NativeSelect
            variant="ghost"
            align="end"
            width={260}
            label="Default"
            ariaLabel="Switch default wallet"
            value={w.id}
            onChange={(id) => id !== w.id && onSwitch(id)}
            options={wallets.map((x) => ({ id: x.id, label: x.label || shortAddr(x.address), media: <WalletIcon provider={x.provider} size={16} /> }))}
          />
        )}
      </div>
      <div className="mt-4 border-t border-line pt-4">{evm ? <Balances address={w.address as `0x${string}`} /> : <FamilyBalances w={w} />}</div>
    </>
  );
}

type TrackFull = { wallets: { address: string; holdings: { chain: string; symbol: string; amount: number; usd: number | null }[]; errors: string[] }[] };

// Non-EVM default: per-chain cells from the tracker snapshot (same data as Auto-tracked balances).
function FamilyBalances({ w }: { w: Wallet }) {
  const fam = walletFamily(w);
  const track = useQuery({ queryKey: ["wallet-track"], queryFn: () => api<TrackFull>("/api/wallets/track"), staleTime: 5 * 60_000 });
  if (fam && WATCH_ONLY.includes(fam)) return <div className="text-[12.5px] text-muted">Watch-only: {FAMILY_LABEL[fam]} balances aren&apos;t readable publicly, so farmOS tracks the address only.</div>;
  if (track.isLoading) return <Skeleton className="h-14" />;
  const t = track.data?.wallets.find((x) => x.address.toLowerCase() === w.address.toLowerCase());
  const hs = t?.holdings ?? [];
  if (hs.length === 0) return <div className="text-[12.5px] text-muted">{t?.errors.length ? "Couldn't read balances right now." : "No balances found."}</div>;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {hs.map((h, i) => (
        <div key={i} className="rounded-lg border border-line bg-panel px-3 py-2">
          <div className="flex items-center gap-1.5 text-[11.5px] text-muted"><ChainLogo chain={h.chain} size={14} />{h.symbol}</div>
          <div className={cn("num text-[14px]", h.amount === 0 && "text-faint")}>{num(h.amount, h.amount < 1 ? 5 : 4)}{h.usd != null && <span className="ml-1 text-[11.5px] text-faint">{usd(h.usd)}</span>}</div>
        </div>
      ))}
    </div>
  );
}
