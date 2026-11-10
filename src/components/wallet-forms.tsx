"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Plus, RefreshCw } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { ChainLogo, ChainStack } from "@/components/chain-logo";
import { MorphingModal } from "@/components/motion/morphing-modal";
import { WalletIcon } from "@/components/wallet-icon";
import { Button, Input, Popover, SectionTitle, Skeleton } from "@/components/ui";
import { api, keys, useWallets } from "@/lib/client/api";
import { chainMeta } from "@/lib/chain-meta";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/client/toast";
import { shortAddr, usd } from "@/lib/format";
import { WALLET_BRANDS } from "@/lib/wallet-brands";

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
  const [refreshing, setRefreshing] = useState(false);
  const { data, isLoading, error } = useQuery({ queryKey: ["wallet-track"], queryFn: () => api<Snapshot>("/api/wallets/track"), enabled: linked.length > 0, staleTime: 5 * 60_000 });
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
            {linked.length > 0 && <Button size="sm" variant="ghost" onClick={refresh} disabled={refreshing || isLoading}><RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} /> Refresh</Button>}
            <Button size="sm" variant={adding ? "subtle" : "ghost"} onClick={() => setAdding((a) => !a)}><Plus className="h-3.5 w-3.5" /> Add wallet</Button>
          </div>
        }
      >
        Wallet balances
      </SectionTitle>
      {adding && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mb-3 rounded-xl border border-line bg-panel p-3">
          <AddWalletForm />
          <p className="mt-2 text-[11.5px] text-faint">Read-only. Or <Link href="/wallets" className="text-accent underline underline-offset-2">connect a browser wallet</Link> and link it.</p>
        </motion.div>
      )}
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
            <div className="num mt-1 text-[30px] font-medium leading-none tracking-[-0.02em]">{usd(total)}</div>
            {chains.length > 0 && (
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
            )}
            <div className="mt-3 text-[11.5px] text-faint">Updated {new Date(data.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · native + main tokens · CoinGecko prices</div>
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

export type WalletModalView = "menu" | "watch";

/**
 * Add-wallet modal (beUI MorphingModal): pick "connect a wallet app" (hands off to
 * RainbowKit) or "watch an address", and the panel morphs between the two views.
 */
export function WalletModal({ view, setView, onConnect, connectLabel = "Connect a wallet app" }: { view: WalletModalView | null; setView: (v: WalletModalView | null) => void; onConnect: () => void; connectLabel?: string }) {
  const qc = useQueryClient();
  const [addr, setAddr] = useState("");
  const [label, setLabel] = useState("");
  const [provider, setProvider] = useState("");
  const [busy, setBusy] = useState(false);
  const close = () => setView(null);
  const submit = async () => {
    if (!addr.trim()) return;
    setBusy(true);
    try {
      await api("/api/wallets", { method: "POST", body: { address: addr.trim(), label: label.trim(), provider } });
      qc.invalidateQueries({ queryKey: keys.wallets });
      qc.invalidateQueries({ queryKey: ["wallet-track"] });
      setAddr("");
      setLabel("");
      setProvider("");
      toast.success("Wallet added");
      close();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <MorphingModal viewId={view} onClose={close} placement="center" className="max-w-[480px] rounded-2xl border-line bg-panel">
      {view === "menu" && (
        <div>
          <h2 className="font-serif text-[22px] leading-tight text-ink">Add a wallet</h2>
          <p className="mt-1 text-[13px] text-muted">Read-only. farmOS never asks for signatures.</p>
          <div className="mt-4 space-y-1.5">
            <button type="button" onClick={() => { close(); setTimeout(onConnect, 180); }} className="flex w-full items-center gap-3 rounded-xl border border-line px-3 py-3 text-left outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
              <span className="flex items-center -space-x-2">
                {(["metamask", "rabby", "phantom"] as const).map((b) => <span key={b} className="rounded-[28%] ring-2 ring-panel"><WalletIcon provider={b} size={26} /></span>)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-ink">{connectLabel}</span>
                <span className="block text-[12.5px] text-muted">MetaMask, Rabby, Coinbase, WalletConnect…</span>
              </span>
            </button>
            <button type="button" onClick={() => setView("watch")} className="flex w-full items-center gap-3 rounded-xl border border-line px-3 py-3 text-left outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
              <span className="flex h-[26px] w-[54px] items-center justify-center"><ChainStack chains={["ethereum", "base", "solana"]} size={22} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-ink">Watch an address</span>
                <span className="block text-[12.5px] text-muted">Paste any EVM or Solana address. No connection needed.</span>
              </span>
            </button>
          </div>
        </div>
      )}
      {view === "watch" && (
        <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <h2 className="font-serif text-[22px] leading-tight text-ink">Watch an address</h2>
          <p className="mt-1 text-[13px] text-muted">EVM (0x…) or Solana. Balances show on Portfolio.</p>
          <div className="mt-4 space-y-2.5">
            <Input autoFocus value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="0x… or Solana address" className="num w-full" />
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
          <div className="mt-5 flex items-center justify-between">
            <Button type="button" variant="ghost" onClick={() => setView("menu")}>Back</Button>
            <Button type="submit" variant="primary" disabled={!addr.trim() || busy}><Plus className="h-3.5 w-3.5" /> Add wallet</Button>
          </div>
        </form>
      )}
    </MorphingModal>
  );
}
