"use client";
import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, BellRing, BellOff, ChevronDown, Minus, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shell";
import { Button, Empty, Input, Pill, SelectPill, Skeleton } from "@/components/ui";
import { TokenPicker, CoinGlyph, type PickedCoin } from "@/components/token-picker";
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
        <>
          {/* Desktop: table. Hidden below md so phones get cards instead of a sideways scroll. */}
          <div className="hidden overflow-hidden rounded-lg border border-line bg-panel md:block">
            <table className="w-full border-collapse">
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

          {/* Mobile: one card per token that expands downwards — never scrolls sideways. */}
          <div className="space-y-2 md:hidden">
            {rows.map((r) => (
              <MobileCard
                key={r.id}
                row={r}
                price={prices[r.coinId]?.usd}
                change={prices[r.coinId]?.usd_24h_change}
                onPatch={(body) => patch.mutate({ id: r.id, ...body })}
                onRemove={() => remove.mutate(r.id)}
              />
            ))}
          </div>
        </>
      )}

      {rows.length > 0 && (
        <p className="mt-4 text-[12px] text-faint">
          Alerts fire from the 12:00 UTC cron and re-arm once the price moves back across the threshold.
        </p>
      )}
    </div>
  );
}

/** Shared "has this alert fired" check so the table and the mobile card can't disagree. */
function isFired(row: WatchRow, price: number | null | undefined) {
  if (price == null) return false;
  if (row.above != null && price >= row.above && !row.alertState?.above) return true;
  if (row.below != null && price <= row.below && !row.alertState?.below) return true;
  return false;
}

function StateBadge({ row, price }: { row: WatchRow; price?: number }) {
  if (isFired(row, price)) return <Pill tone="amber"><BellRing className="h-3 w-3" /> fired</Pill>;
  if (row.above == null && row.below == null) return <span className="text-[12px] text-faint">no alert</span>;
  return <span className="inline-flex items-center gap-1 text-[12px] text-muted"><BellOff className="h-3 w-3" /> armed</span>;
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
  return (
    <tr className={cn("group border-t border-line transition-colors hover:bg-hover", isFired(row, price) && "bg-warning/8")}>
      <td className="h-12 px-3">
        <div className="flex items-center gap-2.5">
          <CoinGlyph coin={{ symbol: row.symbol || row.coinId.slice(0, 3), thumb: row.image }} size={20} />
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
        <SelectPill value={row.alertCurrency || "usd"} options={CURRENCIES} onChange={(v) => onPatch({ alertCurrency: v })} />
      </td>
      <td className="px-2"><StateBadge row={row} price={price} /></td>
      <td className="px-2">
        <button
          onClick={onRemove}
          className="rounded p-1 text-faint transition-colors hover:bg-hover hover:text-neg"
          aria-label={`Remove ${row.symbol || row.coinId} from the watchlist`}
          title="Remove from watchlist"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}

/** Mobile card: summary line that expands downwards into the alert controls. */
function MobileCard({
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
  const [open, setOpen] = useState(false);
  const fired = isFired(row, price);

  return (
    <div className={cn("rounded-lg border border-line bg-panel", fired && "border-warning/40 bg-warning/8")}>
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-2.5 px-3 py-3 text-left">
        <CoinGlyph coin={{ symbol: row.symbol || row.coinId.slice(0, 3), thumb: row.image }} size={26} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13.5px] font-medium uppercase text-ink">{row.symbol || row.coinId.slice(0, 8)}</span>
            {fired && <BellRing className="h-3 w-3 shrink-0 text-warning" />}
          </div>
          <div className="truncate text-[11.5px] text-faint">{row.name || row.coinId}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="num text-[13px] tabular-nums text-ink">{price != null ? usd(price) : "—"}</div>
          <div className={cn("num text-[11px] tabular-nums", change == null ? "text-faint" : change >= 0 ? "text-pos" : "text-neg")}>
            {change == null ? "—" : pct(change)}
          </div>
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-line px-3 py-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-[0.12em] text-muted">Above</div>
              <ThresholdCell value={row.above} onSave={(v) => onPatch({ above: v })} placeholder="Set" block />
            </div>
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-[0.12em] text-muted">Below</div>
              <ThresholdCell value={row.below} onSave={(v) => onPatch({ below: v })} placeholder="Set" block />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-[0.12em] text-muted">Currency</span>
              <SelectPill value={row.alertCurrency || "usd"} options={CURRENCIES} onChange={(v) => onPatch({ alertCurrency: v })} />
            </div>
            <div className="flex items-center gap-2">
              <StateBadge row={row} price={price} />
              <button
                onClick={onRemove}
                className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[12px] text-muted transition-colors hover:border-neg/40 hover:text-neg"
                aria-label={`Remove ${row.symbol || row.coinId} from the watchlist`}
              >
                <Trash2 className="h-3 w-3" /> Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Click-to-edit numeric threshold. Empty clears the alert. */
function ThresholdCell({ value, onSave, placeholder, block }: { value: number | null; onSave: (v: number | null) => void; placeholder: string; block?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (!editing) {
    return (
      <button
        onClick={() => { setEditing(true); setDraft(value != null ? String(value) : ""); }}
        className={cn(
          "num rounded px-1.5 py-0.5 text-[12.5px] tabular-nums transition-colors hover:bg-hover",
          value != null ? "text-ink" : "text-faint",
          block && "w-full border border-line py-1.5 text-left",
        )}
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
      inputMode="decimal"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
      placeholder="$"
      className={cn("h-7 px-1.5 text-[12px]", block ? "w-full" : "w-24")}
    />
  );
}
