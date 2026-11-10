"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Earning } from "@/db/schema";
import { Button, Empty, InlineText, Skeleton } from "@/components/ui";
import { TokenPicker, type PickedCoin } from "@/components/token-picker";
import { cn } from "@/lib/cn";
import { today as todayFn } from "@/lib/dates";
import { money } from "@/lib/fiat";
import { num, pct, shortAddr, tone, usd } from "@/lib/format";
import { api, useProfile } from "@/lib/client/api";
import { parseAmount, useFx, usePrices } from "@/lib/client/prices";
import { toast } from "@/lib/client/toast";

export type EarningRow = Omit<Earning, "createdAt"> & { createdAt: string; priceUsd: number | null; currentUsd: number | null };
export const EARNINGS_KEY = ["earnings"];

export function useEarnings() {
  return useQuery({ queryKey: EARNINGS_KEY, queryFn: () => api<{ earnings: EarningRow[] }>("/api/earnings").then((r) => r.earnings), staleTime: 60_000 });
}

/** Totals: value at claim, current value (falls back to claim value when the token has no live price). */
export function earningTotals(rows: EarningRow[]) {
  const claim = rows.reduce((a, r) => a + (r.valueAtClaim ?? 0), 0);
  const now = rows.reduce((a, r) => a + (r.currentUsd ?? r.valueAtClaim ?? 0), 0);
  const byProject = new Map<string, { claim: number; now: number; count: number }>();
  for (const r of rows) {
    const cur = byProject.get(r.projectId) ?? { claim: 0, now: 0, count: 0 };
    cur.claim += r.valueAtClaim ?? 0;
    cur.now += r.currentUsd ?? r.valueAtClaim ?? 0;
    cur.count++;
    byProject.set(r.projectId, cur);
  }
  return { claim, now, byProject };
}

/** Earnings tab on a project: tokens received with value then and now. */
export function ProjectEarnings({ projectId }: { projectId: string }) {
  const { data, isLoading } = useEarnings();
  const qc = useQueryClient();
  const profile = useProfile();
  const fiat = profile.data?.fiat ?? "idr";
  const fx = useFx();
  const rows = (data ?? []).filter((r) => r.projectId === projectId);
  const t = earningTotals(rows);
  const refresh = () => qc.invalidateQueries({ queryKey: EARNINGS_KEY });
  const patch = async (id: string, body: Record<string, unknown>) => {
    try { await api(`/api/earnings/${id}`, { method: "PATCH", body }); refresh(); } catch (e) { toast.error((e as Error).message); }
  };
  const remove = async (id: string) => {
    await api(`/api/earnings/${id}`, { method: "DELETE" });
    refresh();
  };
  if (isLoading) return <Skeleton className="h-32" />;
  return (
    <div className="space-y-3">
      {rows.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="At claim" value={usd(t.claim)} sub={money(fx.toFiat(t.claim, fiat), fiat, { compact: true })} />
          <Stat label="Now" value={usd(t.now)} sub={money(fx.toFiat(t.now, fiat), fiat, { compact: true })} />
          <Stat label="Change" value={usd(t.now - t.claim, { sign: true })} cls={tone(t.now - t.claim)} sub={t.claim ? pct((t.now - t.claim) / t.claim) : undefined} />
        </div>
      )}
      <div className="overflow-hidden rounded-lg border border-line bg-panel">
        {rows.length === 0 ? (
          <div className="p-3"><Empty icon={<Coins className="h-5 w-5" />} title="Nothing received yet" body="Log each airdrop claim or reward: token, amount and what it was worth when you claimed. The current value updates from live prices." /></div>
        ) : (
          <div className="divide-y divide-line">
            {rows.map((r) => (
              <div key={r.id} className="group grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-0.5 px-3 py-2 text-[13px] sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_110px_110px_28px]">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><span className="font-medium">{r.symbol}</span><span className="num truncate text-faint">{r.claimedAt}{r.wallet ? ` · ${shortAddr(r.wallet)}` : ""}</span></div>
                  {r.note && <div className="truncate text-[12px] text-muted">{r.note}</div>}
                </div>
                <div className="num hidden text-right sm:block"><InlineText mono value={r.amount} onSave={(v) => Number.isFinite(parseAmount(v)) && patch(r.id, { amount: parseAmount(v) })} className="justify-end" /></div>
                <div className="num text-right text-ink-2">
                  <span className="text-[11px] text-faint sm:hidden">{num(r.amount, 4)} · </span>
                  <InlineText mono value={r.valueAtClaim ?? ""} placeholder="value $" onSave={(v) => patch(r.id, { valueAtClaim: v.trim() ? parseAmount(v) : null })} className="justify-end" />
                </div>
                <div className={cn("num text-right", r.currentUsd == null ? "text-faint" : tone((r.currentUsd ?? 0) - (r.valueAtClaim ?? r.currentUsd ?? 0)))} title={r.coinId ? `Live price via ${r.coinId}` : "No CoinGecko id: current value unknown"}>
                  {r.currentUsd == null ? "—" : usd(r.currentUsd)}
                </div>
                <button onClick={() => remove(r.id)} className="justify-self-end rounded p-1 text-faint hover:text-neg [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100" aria-label="Delete earning"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        )}
        <AddEarning projectId={projectId} onDone={refresh} />
      </div>
      <p className="text-[11.5px] text-faint">Values are in USD. “Now” is amount × the live CoinGecko price when a token is picked from search.</p>
    </div>
  );
}

function Stat({ label, value, sub, cls }: { label: string; value: string; sub?: string; cls?: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel px-3 py-2.5">
      <div className="font-label text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className={cn("num mt-0.5 text-[18px] leading-tight", cls)}>{value}</div>
      {sub && <div className="num text-[11.5px] text-faint">{sub}</div>}
    </div>
  );
}

function AddEarning({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const [coin, setCoin] = useState<PickedCoin | null>(null);
  const [symbol, setSymbol] = useState("");
  const [amount, setAmount] = useState("");
  const [value, setValue] = useState("");
  const [day, setDay] = useState(todayFn());
  const [wallet, setWallet] = useState("");
  const [busy, setBusy] = useState(false);
  const px = usePrices([coin?.id]);
  const live = coin ? px.data?.[coin.id]?.usd : undefined;
  const amt = parseAmount(amount);
  const guess = live && Number.isFinite(amt) ? live * amt : null;
  const sym = (coin?.symbol ?? symbol).trim();
  const ok = sym && Number.isFinite(amt) && amt >= 0 && day;
  const submit = async () => {
    if (!ok) return;
    setBusy(true);
    try {
      const v = value.trim() ? parseAmount(value) : guess;
      await api("/api/earnings", { method: "POST", body: { projectId, symbol: sym, coinId: coin?.id ?? null, amount: amt, valueAtClaim: v != null && Number.isFinite(v) ? v : null, claimedAt: day, wallet: wallet.trim() || null } });
      setAmount(""); setValue(""); setWallet("");
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(false);
  };
  const inp = "h-9 rounded-md border border-line bg-bg px-2 text-[16px] outline-none placeholder:text-faint focus:ring-2 focus:ring-[var(--ring)] sm:h-8 sm:text-[13px]";
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex flex-wrap items-center gap-1.5 border-t border-line p-2">
      <Plus className="ml-1 h-3.5 w-3.5 text-faint" />
      <TokenPicker value={coin} onChange={(c) => { setCoin(c); setSymbol(c.symbol); }} className="w-[140px]" compact />
      {!coin && <input className={cn(inp, "w-[90px]")} placeholder="or symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)} />}
      <input className={cn(inp, "num w-[110px]")} placeholder="Amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <input className={cn(inp, "num w-[130px]")} placeholder={guess != null ? `≈ ${usd(guess)}` : "Value at claim $"} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} title="Leave empty to use the current price" />
      <input className={cn(inp, "num w-[150px]")} type="date" value={day} onChange={(e) => setDay(e.target.value)} aria-label="Claimed on" />
      <input className={cn(inp, "num min-w-[120px] flex-1")} placeholder="Wallet (optional)" value={wallet} onChange={(e) => setWallet(e.target.value)} />
      <Button size="sm" variant="primary" type="submit" disabled={!ok || busy}>{busy ? "Saving…" : "Add"}</Button>
    </form>
  );
}
