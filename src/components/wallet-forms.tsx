"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Plus, RefreshCw, Star } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { ChainLogo, ChainStack } from "@/components/chain-logo";
import { DonutChart } from "@/components/donut-chart";
import type { Wallet } from "@wallet-standard/base";
import { MorphingModal } from "@/components/motion/morphing-modal";
import { Tabs, TabsList, TabsTrigger } from "@/components/motion/tabs";
import { KNOWN_WALLETS, brandOf, connectAddress, connectLegacyAptos, hasLegacyAptos, useStandardWallets, walletFamilies, type MultiFamily } from "@/lib/client/multichain-wallets";
import { FAMILY_CHAIN, FAMILY_LABEL, familiesFor, isZcashShielded, type WalletFamily } from "@/lib/wallet-chains";
import { WalletIcon } from "@/components/wallet-icon";
import { Button, Input, Popover, SectionTitle, Skeleton } from "@/components/ui";
import { api, keys, useWallets } from "@/lib/client/api";
import { chainMeta } from "@/lib/chain-meta";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/client/toast";
import { shortAddr, usd } from "@/lib/format";
import { WALLET_BRANDS } from "@/lib/wallet-brands";
import { connectNear, nearWallets } from "@/lib/client/near-wallets";
import { connectCanton } from "@/lib/client/canton-wallet";

type Holding = { chain: string; symbol: string; token: string | null; amount: number; usd: number | null };
type Snapshot = { fetchedAt: string; wallets: { address: string; label: string; holdings: Holding[]; totalUsd: number; errors: string[] }[]; totalUsd: number; cached: boolean };

/** Pick the wallet app (icon) for a wallet. */
export function ProviderPicker({ value, onChange, compact }: { value: string; onChange: (v: string) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [btn, setBtn] = useState<HTMLButtonElement | null>(null);
  const cur = WALLET_BRANDS.find((b) => b.id === value);
  return (
    <>
      <button ref={setBtn} type="button" onClick={() => setOpen((o) => !o)} title={cur?.name ?? "Wallet app"} className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line bg-panel text-[13px] leading-[1.35] text-ink-2 hover:border-line-strong", compact ? "h-8 w-8 justify-center border-transparent bg-transparent hover:bg-hover" : "h-8 px-2")}>
        <WalletIcon provider={value} size={compact ? 22 : 18} />
        {!compact && <><span className="max-w-[110px] truncate">{cur?.name ?? "Wallet app"}</span><ChevronDown className="h-3 w-3 text-faint" /></>}
      </button>
      <Popover anchor={btn} open={open} onClose={() => setOpen(false)} width={220}>
        {[{ id: "", name: "Unknown / other" }, ...WALLET_BRANDS].map((b) => (
          <button key={b.id || "none"} type="button" onClick={() => { onChange(b.id); setOpen(false); }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-hover">
            <WalletIcon provider={b.id} size={18} /> <span className="flex-1">{b.name}</span>
            {b.id === value && <Check className="h-3.5 w-3.5 text-muted" />}
          </button>
        ))}
      </Popover>
    </>
  );
}

/** Add any number of watch-only wallets (EVM or Solana). */
export function AddWalletForm({ onAdded }: { onAdded?: () => void }) {
  const qc = useQueryClient();
  const [addr, setAddr] = useState("");
  const [label, setLabel] = useState("");
  const [provider, setProvider] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!addr.trim()) return;
    setBusy(true);
    try {
      await api("/api/wallets", { method: "POST", body: { address: addr.trim(), label: label.trim(), provider } });
      qc.invalidateQueries({ queryKey: keys.wallets });
      qc.invalidateQueries({ queryKey: ["wallet-track"] });
      setAddr("");
      setLabel("");
      toast.success("Wallet added. Add another any time.");
      onAdded?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex flex-wrap gap-2">
      <ProviderPicker value={provider} onChange={setProvider} />
      <Input value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="0x… or Solana address (watch-only)" className="num min-w-[220px] flex-[2]" />
      <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label, e.g. Farm 03" className="min-w-[130px] flex-1" />
      <Button type="submit" disabled={!addr.trim() || busy}><Plus className="h-3.5 w-3.5" /> Add wallet</Button>
    </form>
  );
}

/** Portfolio card: on-chain balances of every linked wallet, aggregated by chain and by wallet. */
export function WalletBalancesCard() {
  const qc = useQueryClient();
  const { data: wl, isLoading: wLoading } = useWallets();
  const linked = wl?.wallets ?? [];
  const [adding, setAdding] = useState(false);
  const [modalView, setModalView] = useState<WalletModalView | null>(null);
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [chart, setChart] = useState<"bar" | "pie">("bar");
  const { data, isLoading, error } = useQuery({ queryKey: ["wallet-track"], queryFn: () => api<Snapshot>("/api/wallets/track"), enabled: linked.length > 0, staleTime: 5 * 60_000 });
  const nfts = useNfts(linked.length > 0);
  const refresh = async () => {
    setRefreshing(true);
    try {
      qc.setQueryData(["wallet-track"], await api<Snapshot>("/api/wallets/track", { method: "POST" }));
    } catch (e) {
      toast.error((e as Error).message);
    }
    setRefreshing(false);
  };
  const byChain = new Map<string, number>();
  for (const w of data?.wallets ?? []) for (const h of w.holdings) byChain.set(h.chain, (byChain.get(h.chain) ?? 0) + (h.usd ?? 0));
  const chains = [...byChain.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const total = data?.totalUsd ?? 0;
  const providerOf = (a: string) => linked.find((w) => w.address.toLowerCase() === a.toLowerCase())?.provider ?? "";

  return (
    <section className="mb-8">
      <SectionTitle
        right={
          <div className="flex items-center gap-1">
            {chains.length > 0 && (
              <div className="mr-1 flex gap-0.5 rounded-md bg-hover p-0.5">
                <button onClick={() => setChart("bar")} className={cn("rounded px-1.5 py-0.5 text-[11px]", chart === "bar" ? "bg-panel text-ink shadow-sm" : "text-muted hover:text-ink")} aria-label="Bar view">Bars</button>
                <button onClick={() => setChart("pie")} className={cn("rounded px-1.5 py-0.5 text-[11px]", chart === "pie" ? "bg-panel text-ink shadow-sm" : "text-muted hover:text-ink")} aria-label="Pie view">Pie</button>
              </div>
            )}
            {linked.length > 0 && <Button size="sm" variant="ghost" onClick={refresh} disabled={refreshing || isLoading} aria-label="Refresh balances" title="Refresh balances"><RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} /></Button>}
            <Button size="sm" variant={adding ? "subtle" : "ghost"} onClick={() => setAdding((a) => !a)} aria-label="Add wallet" title="Add wallet"><Plus className="h-3.5 w-3.5" /></Button>
          </div>
        }
      >
        Wallet balances
      </SectionTitle>
      <WalletModal view={adding ? (modalView ?? "menu") : null} setView={(v) => { setModalView(v); setAdding(v !== null); }} onConnect={() => router.push("/wallets")} />
      {wLoading ? (
        <Skeleton className="h-28" />
      ) : linked.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-[13.5px] text-muted">
          Add your farming wallets to see their balances here, summed across chains.
          <div className="mt-3"><Button size="sm" variant="primary" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" /> Add a wallet</Button></div>
        </div>
      ) : isLoading ? (
        <Skeleton className="h-28" />
      ) : error || !data ? (
        <div className="rounded-xl border border-dashed border-line px-4 py-5 text-center text-[13px] text-muted">Couldn&apos;t load balances. {(error as Error)?.message}</div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="rounded-xl border border-line bg-panel p-4">
            <div className="text-[12px] font-medium text-muted">Across {data.wallets.length} wallet{data.wallets.length === 1 ? "" : "s"}</div>
            <div className="num mt-1 text-[30px] font-medium leading-none tracking-[-0.02em]">{usd(total + (nfts.data?.totalUsd ?? 0))}</div>
            {Boolean(nfts.data?.totalUsd) && <div className="mt-1 text-[12px] text-muted">Tokens <span className="num text-ink-2">{usd(total)}</span> · NFTs at floor <span className="num text-ink-2">{usd(nfts.data!.totalUsd!)}</span></div>}
            {chains.length > 0 && (
              chart === "pie" ? (
                <div className="mt-4">
                  <DonutChart
                    size={150}
                    slices={chains.map(([c, v], i) => ({ id: c, label: chainMeta(c)?.name ?? c, value: v, color: `var(--chart-${(i % 5) + 1})`, icon: <ChainLogo chain={c} size={14} /> }))}
                    unit={(n) => usd(n, { compact: true })}
                    emptyLabel="No balances yet"
                  />
                </div>
              ) : (
              <>
                <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-hover">
                  {chains.map(([c, v], i) => (
                    <motion.div key={c} title={`${chainMeta(c)?.name ?? c} ${usd(v)}`} initial={{ width: 0 }} animate={{ width: `${(v / Math.max(total, 1e-9)) * 100}%` }} transition={{ delay: i * 0.05, duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }} className="h-full border-r border-panel last:border-0" style={{ background: `var(--chart-${(i % 5) + 1})` }} />
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
                  {chains.map(([c, v]) => (
                    <div key={c} className="flex min-w-0 items-center gap-1.5 text-[12.5px]">
                      <ChainLogo chain={c} size={14} />
                      <span className="truncate text-ink-2">{chainMeta(c)?.name ?? c}</span>
                      <span className="num ml-auto text-muted">{usd(v, { compact: true })}</span>
                    </div>
                  ))}
                </div>
              </>
              )
            )}
          </div>
          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
            {data.wallets.map((w) => (
              <Link key={w.address} href="/wallets" className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-hover/60">
                <WalletIcon provider={providerOf(w.address)} size={24} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px]">{w.label || <span className="text-faint">Unlabeled</span>}</div>
                  <div className="num truncate text-[11.5px] text-muted">{shortAddr(w.address)}</div>
                </div>
                <ChainStack chains={w.holdings.map((h) => h.chain)} size={16} max={4} />
                <span className="num w-[84px] text-right text-[13.5px]">{usd(w.totalUsd)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export type WalletModalView = "menu" | "multichain" | "near" | "watch";

const noop = () => () => {};
/** Phones and tablets: injected wallets only exist inside the wallet app's own browser there. */
const useIsMobile = () => useSyncExternalStore(noop, () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent), () => false);
/** "Open this page in the wallet's in-app browser" universal links (official, documented by each wallet). */
const APP_BROWSE: Record<string, (url: string) => string> = {
  phantom: (u) => `https://phantom.app/ul/browse/${encodeURIComponent(u)}?ref=${encodeURIComponent(new URL(u).origin)}`,
  solflare: (u) => `https://solflare.com/ul/v1/browse/${encodeURIComponent(u)}?ref=${encodeURIComponent(new URL(u).origin)}`,
  okx: (u) => `https://web3.okx.com/download?deeplink=${encodeURIComponent(`okx://wallet/dapp/url?dappUrl=${encodeURIComponent(u)}`)}`,
};

const FAMILY_TABS: { id: MultiFamily; label: string }[] = [
  { id: "solana", label: "Solana" },
  { id: "aptos", label: "Aptos" },
  { id: "sui", label: "Sui" },
];

/**
 * Add-wallet modal (beUI MorphingModal): EVM wallet apps (RainbowKit), Solana / Aptos / Sui wallets
 * (Wallet Standard, address only), or watch any address including Zcash. The panel morphs between views.
 */
export function WalletModal({ view, setView, onConnect, connectLabel = "EVM wallet" }: { view: WalletModalView | null; setView: (v: WalletModalView | null) => void; onConnect: () => void; connectLabel?: string }) {
  const qc = useQueryClient();
  const [addr, setAddr] = useState("");
  const [label, setLabel] = useState("");
  const [provider, setProvider] = useState("");
  const [chain, setChain] = useState<WalletFamily | "">("");
  const [family, setFamily] = useState<MultiFamily>("solana");
  const [busy, setBusy] = useState<string | null>(null);
  const [makeDefault, setMakeDefault] = useState(false);
  const installed = useStandardWallets();
  const mobile = useIsMobile();
  const near = useQuery({ queryKey: ["near-wallets"], queryFn: nearWallets, enabled: view === "near", staleTime: Infinity, retry: 1 });
  const close = () => setView(null);
  const save = async (body: { address: string; label: string; provider: string; chain?: string }) => {
    await api("/api/wallets", { method: "POST", body: { ...body, isDefault: makeDefault || undefined } });
    qc.invalidateQueries({ queryKey: keys.wallets });
    qc.invalidateQueries({ queryKey: ["wallet-track"] });
    qc.invalidateQueries({ queryKey: ["wallet-nfts"] });
  };
  const submit = async () => {
    if (!addr.trim()) return;
    setBusy("watch");
    try {
      await save({ address: addr.trim(), label: label.trim(), provider, chain: chain || undefined });
      setAddr("");
      setLabel("");
      setProvider("");
      setChain("");
      toast.success("Wallet added");
      close();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const families = familiesFor(addr);
  const ambiguous = families.length > 1;
  const shielded = isZcashShielded(addr.trim());

  // One row per wallet for the chosen chain: installed Wallet Standard wallets first, then known ones to install.
  const rows = (() => {
    const list: { key: string; name: string; brand: string; icon?: string; wallet?: Wallet; url?: string; legacy?: boolean }[] = [];
    for (const w of installed) if (walletFamilies(w).includes(family)) list.push({ key: w.name, name: w.name, brand: brandOf(w.name), icon: w.icon, wallet: w });
    for (const k of KNOWN_WALLETS) {
      if (!k.families.includes(family) || list.some((r) => r.brand === k.brand)) continue;
      const legacy = family === "aptos" && (k.brand === "petra" || k.brand === "martian") && hasLegacyAptos(k.brand);
      list.push({ key: k.brand, name: k.name, brand: k.brand, url: legacy ? undefined : k.url, legacy });
    }
    return list;
  })();
  const connectRow = async (r: (typeof rows)[number]) => {
    setBusy(r.key);
    try {
      const address = r.wallet ? await connectAddress(r.wallet, family) : await connectLegacyAptos(r.brand as "petra" | "martian");
      if (!address) throw new Error(`${r.name} isn't available in this browser`);
      await save({ address, label: r.name, provider: r.brand, chain: family });
      toast.success(`${r.name} · ${shortAddr(address)} added`);
      close();
    } catch (e) {
      toast.error((e as Error).message || "Connection cancelled");
    } finally {
      setBusy(null);
    }
  };

  const connectNearRow = async (w: { id: string; name: string; brand: string }) => {
    setBusy(w.id);
    try {
      const accountId = await connectNear(w.id);
      if (!accountId) return; // redirect wallet: farmOS picks the account up on return
      await save({ address: accountId, label: w.name, provider: w.brand, chain: "near" });
      toast.success(`${w.name} · ${accountId} added`);
      close();
    } catch (e) {
      toast.error((e as Error).message || "Connection cancelled");
    } finally {
      setBusy(null);
    }
  };
  const connectCantonWallet = async () => {
    setBusy("canton");
    try {
      const party = await connectCanton();
      await save({ address: party, label: "Canton", provider: "", chain: "canton" });
      toast.success("Canton party added (watch-only)");
      close();
    } catch (e) {
      toast.error((e as Error).message || "No Canton wallet connected");
    } finally {
      setBusy(null);
    }
  };
  const defaultToggle = (
    <button type="button" onClick={() => setMakeDefault((v) => !v)} aria-pressed={makeDefault} className={cn("mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px]", makeDefault ? "border-accent bg-accent/10 text-ink" : "border-line text-muted hover:bg-hover hover:text-ink")}>
      <Star className={cn("h-3.5 w-3.5", makeDefault && "fill-current text-accent")} /> Set as default wallet
    </button>
  );

  const tile = "flex w-full items-center gap-3 rounded-xl border border-line px-3 py-3 text-left outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-[var(--ring)]";
  return (
    <MorphingModal viewId={view} onClose={close} placement="center" className="max-w-[480px] rounded-2xl border-line bg-panel">
      {view === "menu" && (
        <div>
          <h2 className="font-serif text-[22px] leading-tight text-ink">Add a wallet</h2>
          <div className="mt-4 space-y-1.5">
            <button type="button" onClick={() => { close(); setTimeout(onConnect, 180); }} className={tile}>
              <span className="flex w-[62px] items-center -space-x-2">
                {(["metamask", "rabby", "coinbase"] as const).map((b) => <span key={b} className="rounded-[28%] ring-2 ring-panel"><WalletIcon provider={b} size={26} /></span>)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-ink">{connectLabel}</span>
                <span className="block text-[12.5px] text-muted">MetaMask, Rabby, Coinbase, WalletConnect…</span>
              </span>
            </button>
            <button type="button" onClick={() => setView("multichain")} className={tile}>
              <span className="flex w-[62px] items-center -space-x-2">
                {(["phantom", "petra", "slush"] as const).map((b) => <span key={b} className="rounded-[28%] ring-2 ring-panel"><WalletIcon provider={b} size={26} /></span>)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-ink">Solana, Aptos or Sui wallet</span>
                <span className="block text-[12.5px] text-muted">Phantom, Solflare, OKX, Petra, Martian, Nightly, Slush</span>
              </span>
            </button>
            <button type="button" onClick={() => setView("near")} className={tile}>
              <span className="flex w-[62px] items-center -space-x-2">
                {(["meteor", "hot", "mynearwallet"] as const).map((b) => <span key={b} className="rounded-[28%] ring-2 ring-panel"><WalletIcon provider={b} size={26} /></span>)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-ink">NEAR wallet</span>
                <span className="block text-[12.5px] text-muted">Meteor, HOT, MyNearWallet, Nightly, Sender, Intear</span>
              </span>
            </button>
            <button type="button" disabled={busy !== null} onClick={connectCantonWallet} className={cn(tile, "disabled:opacity-60")}>
              <span className="flex w-[62px] items-center"><ChainLogo chain="canton" size={26} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-ink">{busy === "canton" ? "Check your wallet…" : "Canton wallet"}</span>
                <span className="block text-[12.5px] text-muted">Console, Loop or any Canton dApp-standard wallet · watch-only</span>
              </span>
            </button>
            <button type="button" onClick={() => setView("watch")} className={tile}>
              <span className="flex w-[62px] items-center"><ChainStack chains={["ethereum", "solana", "zcash", "monero"]} size={22} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-ink">Watch an address</span>
                <span className="block text-[12.5px] text-muted">Any chain, incl. Zcash and Monero (watch-only)</span>
              </span>
            </button>
          </div>
          {defaultToggle}
        </div>
      )}
      {view === "multichain" && (
        <div>
          <h2 className="font-serif text-[22px] leading-tight text-ink">Connect a wallet</h2>
          <p className="mt-1 text-[13px] text-muted">farmOS reads the address, then disconnects.</p>
          <Tabs value={family} onValueChange={(v) => setFamily(v as MultiFamily)} variant="segment" className="mt-4">
            <TabsList className="grid w-full grid-cols-3">
              {FAMILY_TABS.map((t) => <TabsTrigger key={t.id} value={t.id} icon={<ChainLogo chain={t.id} size={14} />}>{t.label}</TabsTrigger>)}
            </TabsList>
          </Tabs>
          <ul className="mt-3 space-y-1">
            {rows.map((r) => (
              <li key={r.key}>
                {r.url ? (
                  <a href={mobile && APP_BROWSE[r.brand] ? APP_BROWSE[r.brand](location.href) : r.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-hover">
                    <WalletIcon provider={r.brand} size={30} />
                    <span className="flex-1 text-[14px] text-ink-2">{r.name}</span>
                    <span className="text-[12px] text-faint">{mobile && APP_BROWSE[r.brand] ? "Open in app" : "Not installed · Get"}</span>
                  </a>
                ) : (
                  <button type="button" disabled={busy !== null} onClick={() => connectRow(r)} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-hover disabled:opacity-60">
                    {r.brand ? <WalletIcon provider={r.brand} size={30} /> : r.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.icon} alt="" className="h-[30px] w-[30px] rounded-[28%]" />
                    ) : <WalletIcon size={30} />}
                    <span className="flex-1 text-[14px] font-medium text-ink">{r.name}</span>
                    <span className="text-[12px] text-accent">{busy === r.key ? "Check your wallet…" : "Connect"}</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between">
            <Button type="button" variant="ghost" onClick={() => setView("menu")}>Back</Button>
            <button type="button" onClick={() => { setChain(family); setView("watch"); }} className="text-[12.5px] text-muted hover:text-ink">On mobile? Paste the address instead</button>
          </div>
        </div>
      )}
      {view === "near" && (
        <div>
          <h2 className="font-serif text-[22px] leading-tight text-ink">Connect a NEAR wallet</h2>
          <p className="mt-1 text-[13px] text-muted">farmOS signs in without any contract permission, reads the account, then signs out.</p>
          <ul className="mt-3 space-y-1">
            {near.isLoading && [0, 1, 2, 3].map((i) => <li key={i}><Skeleton className="h-11" /></li>)}
            {near.error && <li className="px-2.5 py-2 text-[13px] text-muted">NEAR wallets couldn&apos;t load. Paste the account instead.</li>}
            {(near.data ?? []).map((w) => (
              <li key={w.id}>
                {w.type === "injected" && !w.available ? (
                  <a href={w.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-hover">
                    <WalletIcon provider={w.brand} size={30} />
                    <span className="flex-1 text-[14px] text-ink-2">{w.name}</span>
                    <span className="text-[12px] text-faint">{mobile ? "Get the app" : "Not installed · Get"}</span>
                  </a>
                ) : (
                  <button type="button" disabled={busy !== null} onClick={() => connectNearRow(w)} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-hover disabled:opacity-60">
                    <WalletIcon provider={w.brand} size={30} />
                    <span className="flex-1 text-[14px] font-medium text-ink">{w.name}</span>
                    <span className="text-[12px] text-accent">{busy === w.id ? "Check your wallet…" : w.type === "browser" ? "Sign in" : "Connect"}</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
          {defaultToggle}
          <div className="mt-4 flex items-center justify-between">
            <Button type="button" variant="ghost" onClick={() => setView("menu")}>Back</Button>
            <button type="button" onClick={() => { setChain("near"); setView("watch"); }} className="text-[12.5px] text-muted hover:text-ink">Paste a .near account instead</button>
          </div>
        </div>
      )}
      {view === "watch" && (
        <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <h2 className="font-serif text-[22px] leading-tight text-ink">Watch an address</h2>
          <p className="mt-1 text-[13px] text-muted">EVM, Solana, Aptos, Sui, NEAR, Canton or Zcash. Balances show on Portfolio.</p>
          <div className="mt-4 space-y-2.5">
            <Input autoFocus value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="0x…, name.near, party::1220…, or t1…" className="num w-full" />
            {ambiguous && (
              <div className="flex items-center gap-2 text-[12.5px] text-muted">
                This could be
                {(["aptos", "sui"] as const).map((f) => (
                  <button key={f} type="button" onClick={() => setChain(f)} aria-pressed={chain === f} className={cn("inline-flex h-7 items-center gap-1.5 rounded-lg border px-2 text-[12.5px] leading-[1.35]", chain === f ? "border-accent bg-accent/10 text-ink" : "border-line text-ink-2 hover:bg-hover")}>
                    <ChainLogo chain={f} size={14} /> {FAMILY_LABEL[f]}
                  </button>
                ))}
              </div>
            )}
            {!ambiguous && families[0] && <div className="flex items-center gap-1.5 text-[12px] text-muted"><ChainLogo chain={FAMILY_CHAIN[families[0]]} size={14} /> {FAMILY_LABEL[families[0]]} address</div>}
            {families[0] === "monero" && <p className="text-[12px] text-faint">Monero balances are private (they need a view key). farmOS saves this address as watch-only.</p>}
            {families[0] === "canton" && <p className="text-[12px] text-faint">Canton has no public balance API (Scan is validator-only). farmOS saves this party as watch-only with an explorer link.</p>}
            {shielded && <p className="text-[12px] text-faint">Shielded Zcash balances are private. farmOS can save this address but can only read balances of transparent (t1/t3) addresses.</p>}
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label, e.g. Farm 03" className="w-full" />
            <div>
              <div className="mb-1.5 text-[12px] text-muted">Wallet app</div>
              <div className="flex flex-wrap gap-1.5">
                {[{ id: "", name: "Other" }, ...WALLET_BRANDS].map((b) => (
                  <button key={b.id || "none"} type="button" onClick={() => setProvider(b.id)} title={b.name} aria-pressed={provider === b.id} className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg border px-2 text-[12.5px] leading-[1.35]", provider === b.id ? "border-accent bg-accent/10 text-ink" : "border-line text-ink-2 hover:bg-hover")}>
                    <WalletIcon provider={b.id} size={16} /> {b.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {defaultToggle}
          <div className="mt-5 flex items-center justify-between">
            <Button type="button" variant="ghost" onClick={() => setView("menu")}>Back</Button>
            <Button type="submit" variant="primary" disabled={!addr.trim() || busy !== null || (ambiguous && !chain && !["petra", "martian", "slush"].includes(provider))}><Plus className="h-3.5 w-3.5" /> Add wallet</Button>
          </div>
        </form>
      )}
    </MorphingModal>
  );
}

type NftCol = { slug: string; name: string; image: string | null; chain: string; count: number; floor: number | null; symbol: string | null; usd: number | null; url: string; wallets: string[] };
type NftSnap = { fetchedAt: string; collections: NftCol[]; count: number; totalUsd: number | null; totalNative: { symbol: string; amount: number }[]; errors: string[]; configured: boolean; hidden?: number };
export const useNfts = (enabled = true) => useQuery({ queryKey: ["wallet-nfts"], queryFn: () => api<NftSnap>("/api/wallets/nfts"), enabled, staleTime: 10 * 60_000, retry: false });

const fmtNative = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: n < 1 ? 4 : 2 });

/** Portfolio card: NFTs held across saved wallets (OpenSea), each collection valued at its floor. */
export function NftHoldingsCard() {
  const qc = useQueryClient();
  const { data: wl } = useWallets();
  const linked = wl?.wallets.length ?? 0;
  const { data, isLoading, error } = useNfts(linked > 0);
  const [busy, setBusy] = useState(false);
  const [all, setAll] = useState(false);
  if (!linked) return null;
  const refresh = async () => {
    setBusy(true);
    try {
      qc.setQueryData(["wallet-nfts"], await api<NftSnap>("/api/wallets/nfts", { method: "POST" }));
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(false);
  };
  const cols = data?.collections ?? [];
  const shown = all ? cols : cols.slice(0, 8);
  return (
    <section className="mb-8">
      <SectionTitle right={<Button size="sm" variant="ghost" onClick={refresh} disabled={busy || isLoading}><RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} /> Refresh</Button>}>NFTs</SectionTitle>
      {isLoading ? (
        <Skeleton className="h-28" />
      ) : error || !data ? (
        <div className="rounded-xl border border-dashed border-line px-4 py-5 text-center text-[13px] text-muted">Couldn&apos;t load NFTs. {(error as Error)?.message}</div>
      ) : !data.configured ? (
        <div className="rounded-xl border border-dashed border-line px-4 py-5 text-center text-[13px] text-muted">Add <code className="num">OPENSEA_API_KEY</code> to read NFTs held by your wallets.</div>
      ) : cols.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line px-4 py-5 text-center text-[13px] text-muted">No NFTs found in your saved wallets.</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-panel">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <div className="text-[12px] font-medium text-muted">{data.count.toLocaleString()} NFTs · {cols.length} collections{data.hidden ? <span className="text-faint" title="Collections with no floor, volume or offers"> · {data.hidden} hidden</span> : null}</div>
              <div className="num mt-1 text-[24px] font-medium leading-none tracking-[-0.02em]">{data.totalUsd != null ? usd(data.totalUsd) : "—"}</div>
            </div>
            <div className="num text-right text-[12.5px] text-muted">{data.totalNative.map((t) => <div key={t.symbol}>{fmtNative(t.amount)} {t.symbol} at floor</div>)}</div>
          </div>
          <ul className="divide-y divide-line">
            {shown.map((c) => (
              <li key={c.slug}>
                <a href={c.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-hover/60">
                  {c.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.image} alt="" className="h-9 w-9 shrink-0 rounded-lg border border-line object-cover" loading="lazy" />
                  ) : <span className="h-9 w-9 shrink-0 rounded-lg border border-line bg-hover" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 truncate text-[13.5px] text-ink">{c.name}</div>
                    <div className="flex items-center gap-1.5 text-[11.5px] text-muted"><ChainLogo chain={c.chain} size={12} /><span className="capitalize">{c.chain.replace(/_/g, " ")}</span> · {c.count} held</div>
                  </div>
                  <div className="text-right">
                    <div className="num text-[13px] text-ink-2">{c.floor != null ? `${fmtNative(c.floor)} ${c.symbol}` : <span className="text-faint">No floor</span>}</div>
                    {c.usd != null && <div className="num text-[11.5px] text-muted">{usd(c.usd)}</div>}
                  </div>
                </a>
              </li>
            ))}
          </ul>
          {cols.length > 8 && <button type="button" onClick={() => setAll((a) => !a)} className="w-full border-t border-line px-4 py-2 text-[12.5px] text-muted hover:bg-hover hover:text-ink">{all ? "Show less" : `Show all ${cols.length} collections`}</button>}
        </div>
      )}
    </section>
  );
}
