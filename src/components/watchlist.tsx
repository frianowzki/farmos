"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Bell, Eye, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { WatchItem } from "@/db/schema";
import { Tabs, TabsList, TabsTrigger } from "@/components/motion/tabs";
import { CoinGlyph, TokenPicker } from "@/components/token-picker";
import { Button, Dialog, Empty, Field, Input, NativeSelect, Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { alertRunsLabel } from "@/lib/dates";
import { FIAT_META, money, type Fiat, type PriceQuote } from "@/lib/fiat";
import { api, useProfile } from "@/lib/client/api";
import { fmtInput, parseAmount } from "@/lib/client/prices";
import { toast } from "@/lib/client/toast";

type Item = Omit<WatchItem, "createdAt"> & { createdAt: string };
const KEY = ["watchlist"];

export function useWatchlist() {
  return useQuery({ queryKey: KEY, queryFn: () => api<{ items: Item[]; prices: Record<string, PriceQuote> }>("/api/watchlist"), refetchInterval: 60_000, staleTime: 30_000 });
}

/** Watched tokens with price + 24h change in the profile's currency (or USD), and above/below alerts. */
export function Watchlist() {
  const profile = useProfile();
  const def: Fiat = profile.data?.fiat ?? "idr";
  const [cur, setCur] = useState<"fiat" | "usd">("fiat");
  const fiat: Fiat = cur === "usd" ? "usd" : def;
  const { data, isLoading } = useWatchlist();
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Item | null>(null);
  const [checking, setChecking] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: KEY });

  const add = async (id: string) => {
    try {
      const r = await api<{ exists: boolean }>("/api/watchlist", { method: "POST", body: { coinId: id } });
      if (r.exists) toast("Already on your watchlist");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const remove = async (id: string) => {
    await api(`/api/watchlist/${id}`, { method: "DELETE" });
    refresh();
  };
  const check = async () => {
    setChecking(true);
    try {
      const r = await api<{ checked: number; alerts: number; pending?: number; telegram?: boolean }>("/api/watchlist/check", { method: "POST" });
      if (!r.checked) toast.success("No alerts set yet");
      else if (r.alerts) toast.success(`${r.alerts} alert${r.alerts > 1 ? "s" : ""} sent to Telegram`);
      else if (r.pending && !r.telegram) toast.error(`${r.pending} alert${r.pending > 1 ? "s" : ""} hit, but Telegram isn't linked (Settings → Notifications)`);
      else toast.success(`Checked ${r.checked} alert${r.checked > 1 ? "s" : ""}: nothing new`);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setChecking(false);
  };

  const items = data?.items ?? [];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <TokenPicker value={null} onChange={(c) => add(c.id)} className="w-full sm:w-[220px]" />
        <div className="ml-auto flex items-center gap-2">
          <Tabs value={cur} onValueChange={(v) => setCur(v as "fiat" | "usd")} variant="segment">
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="fiat">{FIAT_META[def].label}</TabsTrigger>
              <TabsTrigger value="usd">USD</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button size="sm" variant="ghost" onClick={check} disabled={checking || !items.length}><BellRing className="h-3.5 w-3.5" /> {checking ? "Checking…" : "Check alerts"}</Button>
        </div>
      </div>
      {isLoading ? (
        <Skeleton className="h-32" />
      ) : items.length === 0 ? (
        <Empty icon={<Eye className="h-5 w-5" />} title="Nothing on the watchlist" body="Add the tokens you farm or hold. Set an above or below price and farmOS pings you on Telegram when it crosses." />
      ) : (
        <div className="divide-y divide-line rounded-lg border border-line bg-panel">
          <AnimatePresence initial={false}>
            {items.map((it) => {
              const q = data?.prices[it.coinId];
              const px = q ? q[fiat] : null;
              const ch = q?.change24h ?? null;
              const ac = it.alertCurrency as Fiat;
              const fired = Boolean(it.alertState?.above || it.alertState?.below);
              return (
                <motion.div key={it.id} layout="position" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.18 }} className="group flex items-center gap-3 px-3 py-2.5">
                  <CoinGlyph coin={{ symbol: it.symbol, thumb: it.image }} size={24} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-medium">{it.symbol} <span className="font-normal text-muted">{it.name}</span></div>
                    <button type="button" onClick={() => setEdit(it)} className="flex max-w-full items-center gap-1.5 truncate text-[12px] text-faint hover:text-ink-2">
                      {fired ? <BellRing className="h-3 w-3 text-accent" /> : <Bell className="h-3 w-3" />}
                      {it.above == null && it.below == null ? "Set alert" : (
                        <span className="num truncate">
                          {it.above != null && <>≥ {money(it.above, ac)}</>}
                          {it.above != null && it.below != null && " · "}
                          {it.below != null && <>≤ {money(it.below, ac)}</>}
                        </span>
                      )}
                    </button>
                  </div>
                  <div className="text-right">
                    <div className="num text-[13.5px]">{px != null ? money(px, fiat) : "—"}</div>
                    <div className={cn("num text-[12px]", ch == null ? "text-faint" : ch >= 0 ? "text-pos" : "text-neg")}>{ch == null ? (q?.stale ? "cached" : "—") : `${ch >= 0 ? "+" : "−"}${Math.abs(ch).toFixed(2)}%`}</div>
                  </div>
                  <button onClick={() => remove(it.id)} className="rounded p-1 text-faint hover:text-neg [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100" aria-label={`Remove ${it.symbol}`}><Trash2 className="h-3.5 w-3.5" /></button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
      <p className="text-[11.5px] text-faint">Prices refresh every minute while open. Alerts are checked twice a day ({alertRunsLabel(profile.data?.tz)}) and when you press Check alerts.</p>
      <AlertDialog item={edit} onClose={() => setEdit(null)} onSaved={refresh} price={edit ? data?.prices[edit.coinId] : undefined} def={def} />
    </div>
  );
}

function AlertDialog({ item, onClose, onSaved, price, def }: { item: Item | null; onClose: () => void; onSaved: () => void; price?: PriceQuote; def: Fiat }) {
  return (
    <Dialog open={item !== null} onClose={onClose} title={item ? `${item.symbol} alerts` : ""} width={420}>
      {item && <AlertForm key={item.id} item={item} price={price} def={def} onDone={() => { onSaved(); onClose(); }} />}
    </Dialog>
  );
}

function AlertForm({ item, price, def, onDone }: { item: Item; price?: PriceQuote; def: Fiat; onDone: () => void }) {
  const [cur, setCur] = useState<Fiat>(item.above != null || item.below != null ? (item.alertCurrency as Fiat) : def);
  const [above, setAbove] = useState(item.above != null ? fmtInput(item.above, 8) : "");
  const [below, setBelow] = useState(item.below != null ? fmtInput(item.below, 8) : "");
  const [busy, setBusy] = useState(false);
  const now = price ? price[cur] : null;
  const save = async (clear = false) => {
    const a = above.trim() ? parseAmount(above) : null;
    const b = below.trim() ? parseAmount(below) : null;
    if (!clear && ((a != null && !(a > 0)) || (b != null && !(b > 0)))) return toast.error("Enter a price above 0");
    setBusy(true);
    try {
      await api(`/api/watchlist/${item.id}`, { method: "PATCH", body: clear ? { above: null, below: null } : { above: a, below: b, alertCurrency: cur } });
      toast.success(clear ? "Alerts cleared" : "Alerts saved");
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(false);
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-3">
      <Field label="Currency">
        <NativeSelect value={cur} onChange={(v) => setCur(v as Fiat)} options={(["idr", "php", "usdt", "usd"] as Fiat[]).map((f) => ({ id: f, label: FIAT_META[f].label }))} />
      </Field>
      {now != null && <p className="num text-[12.5px] text-muted">Now {money(now, cur)}</p>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Alert above"><Input className="num text-[16px] sm:text-[13.5px]" inputMode="decimal" value={above} onChange={(e) => setAbove(e.target.value)} placeholder="—" /></Field>
        <Field label="Alert below"><Input className="num text-[16px] sm:text-[13.5px]" inputMode="decimal" value={below} onChange={(e) => setBelow(e.target.value)} placeholder="—" /></Field>
      </div>
      <p className="text-[12px] text-faint">Sent once to your linked Telegram, then re-armed when the price moves back.</p>
      <div className="flex justify-between gap-2 pt-1">
        <Button type="button" variant="danger" disabled={busy || (item.above == null && item.below == null)} onClick={() => save(true)}>Clear</Button>
        <Button type="submit" variant="primary" disabled={busy}>{busy ? "Saving…" : "Save alerts"}</Button>
      </div>
    </form>
  );
}
