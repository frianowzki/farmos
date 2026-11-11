"use client";
import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, BellRing, BellOff, Minus, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shell";
import { Button, Empty, Input, Pill, SelectPill, Skeleton } from "@/components/ui";
import { TokenPicker, type PickedCoin } from "@/components/token-picker";
import { cn } from "@/lib/cn";
import { pct, usd } from "@/lib/format";
import { firedAlerts, useWatchlist, useWatchMutations, type WatchRow } from "@/components/watchlist";

const CURRENCIES = [
  { id: "usd", label: "USD" },
  { id: "usdt", label: "USDT" },
  { id: "idr", label: "IDR" },
  { id: "php", label: "PHP" },
];

export function WatchlistView() {
  const { data, isLoading, error } = useWatchlist();
  const { add, patch, remove } = useWatchMutations();
  const [adding, setAdding] = useState(false);
  const [coin, setCoin] = useState<PickedCoin | null>(null);

  const rows = data?.items ?? [];
  const prices = data?.prices ?? {};
  const fired = firedAlerts(rows, prices);

  const submit = () => {
    if (!coin) return setAdding(false);
    add.mutate(coin.id, { onSettled: () => { setCoin(null); setAdding(false); } });
  };

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Watchlist"
        subtitle={
          rows.length === 0
            ? "Tokens you're tracking, with price alerts."
            : `${rows.length} token${rows.length > 1 ? "s" : ""}${fired.length > 0 ? ` · ${fired.length} alert${fired.length > 1 ? "s" : ""} fired` : ""}`
        }
        right={
          <Button size="sm" onClick={() => setAdding((v) => !v)}>
            <Plus className="h-3.5 w-3.5" /> Add token
          </Button>
        }
      />

      {adding && (
        <div className="mb-4 flex max-w-md items-center gap-2">
          <TokenPicker value={coin} onChange={setCoin} className="flex-1" />
          <Button onClick={submit} disabled={!coin || add.isPending}>
            {add.isPending ? "Adding…" : "Add"}
          </Button>
        </div>
      )}

      {add.isError && <p className="mb-4 text-[12.5px] text-neg">{(add.error as Error).message}</p>}

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : error ? (
        <Empty title="Couldn't load the watchlist" body={(error as Error).message} />
      ) : rows.length === 0 ? (
        <Empty
          title="Nothing watched yet"
          body="Add a token by its CoinGecko id — ethereum, solana, bitcoin."
          action={<Button onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" /> Add your first token</Button>}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-panel">
          <table className="w-full min-w-[860px] border-collapse">
            <thead>
              <tr className="text-[12px] text-muted">
                <th className="h-8 px-3 text-left font-medium">Token</th>
                <th className="h-8 px-2 text-right font-medium">Price</th>
                <th className="h-8 px-2 text-right font-medium">24h</th>
                <th className="h-8 px-2 text-left font-medium">Alert above</th>
                <th className="h-8 px-2 text-left font-medium">Alert below</th>
                <th className="h-8 px-2 text-left font-medium">Currency</th>
                <th className="h-8 px-2 text-left font-medium">State</th>
                <th className="h-8 w-10 px-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Row
                  key={r.id}
                  row={r}
                  price={prices[r.coinId]?.usd}
                  change={prices[r.coinId]?.usd_24h_change}
                  onPatch={(body) => patch.mutate({ id: r.id, ...body })}
                  onRemove={() => remove.mutate(r.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && (
        <p className="mt-4 text-[12px] text-faint">
          Alerts fire from the 12:00 UTC cron and re-arm once the price moves back across the threshold.
        </p>
      )}
    </div>
  );
}

function Row({
  row,
  price,
  change,
  onPatch,
  onRemove,
}: {
  row: WatchRow;
  price?: number;
  change?: number;
  onPatch: (body: { above?: number | null; below?: number | null; alertCurrency?: string }) => void;
  onRemove: () => void;
}) {
  const aboveFired = row.above != null && price != null && price >= row.above && !row.alertState?.above;
  const belowFired = row.below != null && price != null && price <= row.below && !row.alertState?.below;
  const fired = aboveFired || belowFired;

  return (
    <tr className={cn("group border-t border-line transition-colors hover:bg-hover", fired && "bg-warning/8")}>
      <td className="h-12 px-3">
        <div className="flex items-center gap-2.5">
          {row.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.image} alt="" width={20} height={20} className="shrink-0 rounded-full" loading="lazy" />
          ) : (
            <span className="h-5 w-5 shrink-0 rounded-full bg-line" />
          )}
          <div className="min-w-0">
            <div className="text-[13px] font-medium uppercase text-ink">{row.symbol || row.coinId.slice(0, 8)}</div>
            <div className="truncate text-[11.5px] text-faint">{row.name || row.coinId}</div>
          </div>
        </div>
      </td>
      <td className="num px-2 text-right text-[13px] tabular-nums text-ink">{price != null ? usd(price) : "—"}</td>
      <td className={cn("num px-2 text-right text-[12px] tabular-nums", change == null ? "text-faint" : change >= 0 ? "text-pos" : "text-neg")}>
        {change == null ? "—" : (
          <span className="inline-flex items-center justify-end gap-0.5">
            {change >= 0.05 ? <ArrowUpRight className="h-3 w-3" /> : change <= -0.05 ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {pct(change)}
          </span>
        )}
      </td>
      <td className="px-2"><ThresholdCell value={row.above} onSave={(v) => onPatch({ above: v })} placeholder="—" /></td>
      <td className="px-2"><ThresholdCell value={row.below} onSave={(v) => onPatch({ below: v })} placeholder="—" /></td>
      <td className="px-2">
        <SelectPill
          value={row.alertCurrency || "usd"}
          options={CURRENCIES}
          onChange={(v) => onPatch({ alertCurrency: v })}
        />
      </td>
      <td className="px-2">
        {fired ? (
          <Pill tone="amber"><BellRing className="h-3 w-3" /> fired</Pill>
        ) : row.above == null && row.below == null ? (
          <span className="text-[12px] text-faint">no alert</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[12px] text-muted"><BellOff className="h-3 w-3" /> armed</span>
        )}
      </td>
      <td className="px-2">
        <button
          onClick={onRemove}
          className="text-faint opacity-0 transition-opacity hover:text-neg group-hover:opacity-100"
          aria-label={`Stop watching ${row.symbol || row.coinId}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}

/** Click-to-edit numeric threshold. Empty clears the alert. */
function ThresholdCell({ value, onSave, placeholder }: { value: number | null; onSave: (v: number | null) => void; placeholder: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (!editing) {
    return (
      <button
        onClick={() => { setEditing(true); setDraft(value != null ? String(value) : ""); }}
        className={cn("num rounded px-1.5 py-0.5 text-[12.5px] tabular-nums transition-colors hover:bg-hover", value != null ? "text-ink" : "text-faint")}
      >
        {value != null ? usd(value) : placeholder}
      </button>
    );
  }

  const commit = () => {
    const n = Number(draft);
    onSave(draft.trim() === "" || !Number.isFinite(n) ? null : n);
    setEditing(false);
  };

  return (
    <Input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
      placeholder="$"
      className="h-7 w-24 px-1.5 text-[12px]"
    />
  );
}
