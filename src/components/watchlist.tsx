"use client";
import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, BellRing, Minus, Plus, X } from "lucide-react";
import { useState } from "react";
import { Button, Input } from "@/components/ui";
import { cn } from "@/lib/cn";
import { api } from "@/lib/client/api";
import { pct, usd } from "@/lib/format";

export type WatchRow = {
  id: string;
  coinId: string;
  symbol: string;
  name: string;
  image: string | null;
  above: number | null;
  below: number | null;
  alertCurrency: string;
  alertState: { above?: string | null; below?: string | null };
};

type Price = { usd?: number; usd_24h_change?: number };

const WATCH_KEY: QueryKey = ["watchlist"];

/** The profile's watchlist with live prices, plus the currency used to express thresholds. */
export function useWatchlist() {
  return useQuery({
    queryKey: WATCH_KEY,
    queryFn: () => api<{ items: WatchRow[]; prices: Record<string, Price> }>("/api/watchlist"),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}

function useWatchMutations() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: WATCH_KEY });
  const add = useMutation({
    mutationFn: (coinId: string) => api("/api/watchlist", { method: "POST", body: { coinId } }),
    onSuccess: done,
  });
  const patch = useMutation({
    mutationFn: ({ id, ...body }: { id: string; above?: number | null; below?: number | null }) =>
      api(`/api/watchlist/${id}`, { method: "PATCH", body }),
    onSuccess: done,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/watchlist/${id}`, { method: "DELETE" }),
    onSuccess: done,
  });
  return { add, patch, remove };
}

/** A row whose threshold has already fired and not been re-armed — the ones worth surfacing first. */
export function firedAlerts(rows: WatchRow[], prices: Record<string, Price>) {
  return rows.filter((r) => {
    const p = prices[r.coinId]?.usd;
    if (p == null) return false;
    if (r.above != null && p >= r.above && !r.alertState?.above) return true;
    if (r.below != null && p <= r.below && !r.alertState?.below) return true;
    return false;
  });
}

export function Watchlist() {
  const { data, isLoading } = useWatchlist();
  const { add, patch, remove } = useWatchMutations();
  const [adding, setAdding] = useState(false);
  const [val, setVal] = useState("");
  const rows = data?.items ?? [];
  const prices = data?.prices ?? {};

  const submit = () => {
    const v = val.trim();
    if (!v) return setAdding(false);
    add.mutate(v.toLowerCase(), { onSettled: () => { setVal(""); setAdding(false); } });
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h3 className="font-label text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Watchlist</h3>
        <span className="num text-[11px] text-faint">{rows.length}</span>
        <button
          onClick={() => setAdding((v) => !v)}
          className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded-md text-muted transition-colors hover:bg-hover hover:text-ink"
          aria-label="Add a token"
          title="Add a token (CoinGecko id, e.g. ethereum)"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {adding && (
        <div className="mb-2 flex gap-1.5">
          <Input
            autoFocus
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") { setAdding(false); setVal(""); } }}
            placeholder="coingecko id — ethereum, solana…"
            className="h-8 text-[12.5px]"
          />
          <Button onClick={submit} disabled={add.isPending} className="h-8 shrink-0 text-[12px]">Add</Button>
        </div>
      )}

      {add.isError && <p className="mb-2 text-[11.5px] text-neg">{(add.error as Error).message}</p>}

      {isLoading ? (
        <p className="py-3 text-[12.5px] text-faint">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line py-6 text-center text-[12.5px] text-muted">
          No tokens watched yet.
        </p>
      ) : (
        <ul className="space-y-1">
          {rows.map((r) => {
            const p = prices[r.coinId];
            const price = p?.usd;
            const change = p?.usd_24h_change;
            const fired = firedAlerts([r], prices).length > 0;
            return (
              <li key={r.id} className={cn("group flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-hover", fired && "bg-warning/8")}>
                {r.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.image} alt="" width={18} height={18} className="shrink-0 rounded-full" loading="lazy" />
                ) : (
                  <span className="h-[18px] w-[18px] shrink-0 rounded-full bg-line" />
                )}
                <span className="w-12 shrink-0 text-[12.5px] font-medium uppercase text-ink">{r.symbol || r.coinId.slice(0, 6)}</span>
                <span className="num ml-auto text-[12.5px] tabular-nums text-ink">{price != null ? usd(price) : "—"}</span>
                {change != null && (
                  <span className={cn("num flex w-16 items-center justify-end gap-0.5 text-[11.5px] tabular-nums", change >= 0 ? "text-pos" : "text-neg")}>
                    {change >= 0.05 ? <ArrowUpRight className="h-3 w-3" /> : change <= -0.05 ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                    {pct(change)}
                  </span>
                )}
                {fired && <BellRing className="h-3 w-3 shrink-0 text-warning" aria-label="Alert fired" />}
                <button
                  onClick={() => remove.mutate(r.id)}
                  className="shrink-0 text-faint opacity-0 transition-opacity hover:text-neg group-hover:opacity-100"
                  aria-label={`Stop watching ${r.symbol || r.coinId}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {rows.length > 0 && (
        <div className="mt-2 flex items-center gap-3 border-t border-line pt-2">
          <span className="text-[11.5px] text-faint">Alert when</span>
          {(["above", "below"] as const).map((dir) => (
            <ThresholdEditor key={dir} dir={dir} rows={rows} onSave={(id, value) => patch.mutate({ id, [dir]: value })} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Compact editor for the "above"/"below" thresholds, applying to every watched token at once would be
 *  surprising, so this writes to the first row and the per-token row keeps its own value. */
function ThresholdEditor({ dir, rows, onSave }: { dir: "above" | "below"; rows: WatchRow[]; onSave: (id: string, v: number | null) => void }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState("");
  const row = rows[0];

  if (!open) {
    const current = row?.[dir];
    return (
      <button
        onClick={() => { setOpen(true); setV(current != null ? String(current) : ""); }}
        className="num inline-flex items-center gap-1 rounded border border-line px-1.5 py-0.5 text-[11px] text-muted transition-colors hover:bg-hover hover:text-ink"
      >
        {dir} {current != null ? usd(current) : "—"}
      </button>
    );
  }

  const commit = () => {
    const n = Number(v);
    onSave(row.id, v.trim() === "" || !Number.isFinite(n) ? null : n);
    setOpen(false);
  };

  return (
    <span className="inline-flex items-center gap-1">
      <span className="num text-[11px] text-faint">{dir}</span>
      <Input
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setOpen(false); }}
        placeholder="$"
        className="h-6 w-20 px-1.5 text-[11.5px]"
      />
    </span>
  );
}
