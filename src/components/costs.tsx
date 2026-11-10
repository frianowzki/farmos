"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Flame, Plus, Trash2, Wallet as WalletIcon, Receipt } from "lucide-react";
import { useState } from "react";
import type { Cost } from "@/db/schema";
import { Button, Dialog, Empty, Popover, Skeleton } from "@/components/ui";
import { ChainLabel, ChainLogo } from "@/components/chain-logo";
import { TokenPicker, type PickedCoin } from "@/components/token-picker";
import { earningTotals, useEarnings } from "@/components/earnings";
import { CHAINS } from "@/lib/chain-meta";
import { cn } from "@/lib/cn";
import { today as todayFn } from "@/lib/dates";
import { num, pct, tone, usd } from "@/lib/format";
import { api } from "@/lib/client/api";
import { parseAmount, usePrices } from "@/lib/client/prices";
import { toast } from "@/lib/client/toast";

export type CostRow = Omit<Cost, "createdAt"> & { createdAt: string; priceUsd: number | null; currentUsd: number | null };
export const COSTS_KEY = ["costs"];
export const COST_TYPES = [
  { id: "gas", label: "Gas fee", icon: Flame },
  { id: "capital", label: "Capital / deposit", icon: WalletIcon },
  { id: "other", label: "Other", icon: Receipt },
] as const;

export function useCosts() {
  return useQuery({ queryKey: COSTS_KEY, queryFn: () => api<{ costs: CostRow[] }>("/api/costs").then((r) => r.costs), staleTime: 60_000 });
}

/** Spent = USD at entry (falls back to live value); split by type, per project. */
export function costTotals(rows: CostRow[]) {
  const at = (r: CostRow) => r.valueAtEntry ?? r.currentUsd ?? 0;
  const byProject = new Map<string, { spent: number; gas: number; capital: number; other: number; now: number; count: number }>();
  let spent = 0, gas = 0, capital = 0, other = 0, now = 0;
  for (const r of rows) {
    const v = at(r);
    spent += v;
    now += r.currentUsd ?? v;
    if (r.type === "gas") gas += v; else if (r.type === "capital") capital += v; else other += v;
    const c = byProject.get(r.projectId) ?? { spent: 0, gas: 0, capital: 0, other: 0, now: 0, count: 0 };
    c.spent += v; c.now += r.currentUsd ?? v; c.count++;
    if (r.type === "gas") c.gas += v; else if (r.type === "capital") c.capital += v; else c.other += v;
    byProject.set(r.projectId, c);
  }
  return { spent, gas, capital, other, now, byProject };
}

/** ROI of the ledger: (earned now − spent) / spent. */
export const ledgerRoi = (spent: number, earned: number) => (spent > 0 ? (earned - spent) / spent : null);

export function ProjectCosts({ projectId }: { projectId: string }) {
  const { data, isLoading } = useCosts();
  const earn = useEarnings();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const rows = (data ?? []).filter((r) => r.projectId === projectId);
  const t = costTotals(rows);
  const earned = earningTotals((earn.data ?? []).filter((r) => r.projectId === projectId)).now;
  const roi = ledgerRoi(t.spent, earned);
  const refresh = () => qc.invalidateQueries({ queryKey: COSTS_KEY });
  const remove = async (id: string) => {
    try { await api(`/api/costs/${id}`, { method: "DELETE" }); refresh(); } catch (e) { toast.error((e as Error).message); }
  };
  if (isLoading) return <Skeleton className="h-32" />;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Spent" value={usd(t.spent)} sub={`gas ${usd(t.gas, { compact: true })} · capital ${usd(t.capital, { compact: true })}`} />
        <Stat label="Spent, now" value={usd(t.now)} sub="live token prices" />
        <Stat label="Earned" value={usd(earned)} sub="Earnings tab, live" />
        <Stat label="ROI" value={roi == null ? "—" : pct(roi)} cls={tone(roi)} sub={roi == null ? "log a cost first" : usd(earned - t.spent, { sign: true })} />
      </div>
      <div className="overflow-hidden rounded-lg border border-line bg-panel">
        {rows.length === 0 ? (
          <div className="p-3"><Empty icon={<Flame className="h-5 w-5" />} title="No costs logged" body="Log gas fees, deposits and other spend in any token. farmOS keeps the $ value when you paid and the live value now." /></div>
        ) : (
          <div className="divide-y divide-line">
            {rows.map((r) => {
              const T = COST_TYPES.find((x) => x.id === r.type) ?? COST_TYPES[2];
              return (
                <div key={r.id} className="group grid grid-cols-[minmax(0,1fr)_auto_28px] items-center gap-x-3 px-3 py-2 text-[13px] sm:grid-cols-[minmax(0,1.5fr)_110px_110px_28px]">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <T.icon className="h-3.5 w-3.5 shrink-0 text-muted" />
                      <span className="num font-medium">{num(r.amount, 6)} {r.symbol}</span>
                      {r.chain && <ChainLogo chain={r.chain} size={14} title fallback />}
                      <span className="num truncate text-[12px] text-faint">{r.spentAt}</span>
                    </div>
                    {(r.note || T.id !== "gas") && <div className="truncate pl-[22px] text-[12px] text-muted">{T.label}{r.note ? ` · ${r.note}` : ""}</div>}
                  </div>
                  <div className="num text-right text-ink-2" title="Value when paid">
                    {r.valueAtEntry == null ? <span className="text-faint">—</span> : usd(r.valueAtEntry)}
                    <div className="text-[11px] text-faint sm:hidden">{r.currentUsd == null ? "" : `now ${usd(r.currentUsd)}`}</div>
                  </div>
                  <div className="num hidden text-right text-muted sm:block" title="Value now">{r.currentUsd == null ? "—" : usd(r.currentUsd)}</div>
                  <button onClick={() => remove(r.id)} className="justify-self-end rounded p-1 text-faint hover:text-neg [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100" aria-label="Delete cost"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              );
            })}
          </div>
        )}
        <div className="border-t border-line p-2">
          <Button size="sm" variant="ghost" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" /> Add gas fee or capital</Button>
        </div>
      </div>
      <p className="text-[11.5px] text-faint">USD. “At entry” is saved when you add it (live price × amount unless you type a value); “now” follows CoinGecko.</p>
      <AddCostDialog open={adding} projectId={projectId} onClose={() => setAdding(false)} onDone={refresh} />
    </div>
  );
}

function Stat({ label, value, sub, cls }: { label: string; value: string; sub?: string; cls?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-panel px-3 py-2.5">
      <div className="font-label text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className={cn("num mt-0.5 truncate text-[18px] leading-tight", cls)}>{value}</div>
      {sub && <div className="num truncate text-[11.5px] text-faint">{sub}</div>}
    </div>
  );
}

const DEFAULT_COIN: PickedCoin = { id: "tether", name: "Tether", symbol: "USDT", thumb: null };

export function AddCostDialog({ open, projectId, onClose, onDone }: { open: boolean; projectId: string; onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState<"gas" | "capital" | "other">("gas");
  const [coin, setCoin] = useState<PickedCoin>(DEFAULT_COIN);
  const [amount, setAmount] = useState("");
  const [value, setValue] = useState("");
  const [chain, setChain] = useState<string | null>(null);
  const [day, setDay] = useState(todayFn());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const px = usePrices([coin.id]);
  const live = px.data?.[coin.id]?.usd;
  const amt = parseAmount(amount);
  const liveValue = live != null && Number.isFinite(amt) ? live * amt : null;
  const typed = value.trim() ? parseAmount(value) : null;
  const entry = typed != null && Number.isFinite(typed) ? typed : liveValue;
  const ok = Number.isFinite(amt) && amt > 0 && day;
  const submit = async () => {
    if (!ok) return;
    setBusy(true);
    try {
      await api("/api/costs", { method: "POST", body: { projectId, type, symbol: coin.symbol, coinId: coin.id, chain, amount: amt, valueAtEntry: entry != null && Number.isFinite(entry) ? entry : null, spentAt: day, note: note.trim() || null } });
      toast.success("Cost added");
      setAmount(""); setValue(""); setNote("");
      onDone();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(false);
  };
  const inp = "h-9 w-full rounded-md border border-line bg-bg px-2.5 text-[16px] outline-none placeholder:text-faint focus:ring-2 focus:ring-[var(--ring)] sm:text-[13.5px]";
  const lab = "mb-1 block text-[12px] font-medium text-muted";
  return (
    <Dialog open={open} onClose={onClose} title="Add gas fee or capital">
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-3.5">
        <div className="grid grid-cols-3 gap-1.5">
          {COST_TYPES.map((x) => (
            <button key={x.id} type="button" onClick={() => setType(x.id)} aria-pressed={type === x.id} className={cn("flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[12px] transition-colors", type === x.id ? "border-accent bg-accent-soft text-ink" : "border-line text-muted hover:border-line-strong hover:text-ink")}>
              <x.icon className="h-4 w-4" /> <span className="truncate">{x.label}</span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-2">
          <div><span className={lab}>Token</span><TokenPicker value={coin} onChange={setCoin} className="w-full" /></div>
          <label><span className={lab}>Amount</span><input className={cn(inp, "num")} inputMode="decimal" placeholder="0.0" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><span className={lab}>Chain (optional)</span><ChainPicker value={chain} onChange={setChain} /></div>
          <label><span className={lab}>Date</span><input className={cn(inp, "num")} type="date" value={day} onChange={(e) => setDay(e.target.value)} /></label>
        </div>
        <label className="block"><span className={lab}>$ value when paid <span className="font-normal text-faint">(optional)</span></span>
          <input className={cn(inp, "num")} inputMode="decimal" placeholder={liveValue != null ? `≈ ${usd(liveValue)} at live price` : "USD"} value={value} onChange={(e) => setValue(e.target.value)} />
        </label>
        <label className="block"><span className={lab}>Note</span><input className={inp} placeholder="Bridge, deposit to vault, quest fee…" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} /></label>
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-[12.5px]">
          <div><div className="text-faint">Live value</div><div className="num text-[15px] text-ink">{liveValue == null ? "—" : usd(liveValue)}</div>{live != null && <div className="num text-[11px] text-faint">1 {coin.symbol} = {usd(live)}</div>}</div>
          <div><div className="text-faint">Saved as at entry</div><div className="num text-[15px] text-ink">{entry == null || !Number.isFinite(entry) ? "—" : usd(entry)}</div><div className="text-[11px] text-faint">{typed != null ? "your value" : "live price now"}</div></div>
        </div>
        <div className="flex justify-end gap-2 pt-0.5">
          <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={!ok || busy}>{busy ? "Saving…" : "Add"}</Button>
        </div>
      </form>
    </Dialog>
  );
}

function ChainPicker({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [btn, setBtn] = useState<HTMLButtonElement | null>(null);
  return (
    <>
      <button ref={setBtn} type="button" onClick={() => setOpen((o) => !o)} className="flex h-9 w-full min-w-0 items-center gap-2 rounded-md border border-line bg-bg px-2.5 text-left text-[13.5px] hover:bg-hover">
        <span className="min-w-0 flex-1 truncate">{value ? <ChainLabel chain={value} /> : <span className="text-faint">Any</span>}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" />
      </button>
      <Popover anchor={btn} open={open} onClose={() => setOpen(false)} width={220}>
        <div className="max-h-[280px] overflow-y-auto p-1">
          <button type="button" onClick={() => { onChange(null); setOpen(false); }} className="w-full rounded-md px-2 py-1.5 text-left text-[13px] text-muted hover:bg-hover">No chain</button>
          {CHAINS.map((c) => (
            <button key={c.key} type="button" onClick={() => { onChange(c.name); setOpen(false); }} className={cn("flex w-full items-center rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-hover", value === c.name && "bg-active")}>
              <ChainLabel chain={c.key} />
            </button>
          ))}
        </div>
      </Popover>
    </>
  );
}
