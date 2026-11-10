"use client";
import { ArrowRightLeft, ArrowUpRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { FIAT_META, money, type Fiat } from "@/lib/fiat";
import { useProfile } from "@/lib/client/api";
import { fmtInput, parseAmount, usePrices } from "@/lib/client/prices";
import { CoinGlyph, TokenPicker, type PickedCoin } from "@/components/token-picker";
import { Skeleton } from "@/components/ui";

const ETH: PickedCoin = { id: "ethereum", name: "Ethereum", symbol: "ETH", thumb: "https://coin-images.coingecko.com/coins/images/279/thumb/ethereum.png" };
const STORE = (pid: string) => `farmos:converter:${pid}`;

/** Order shown: the profile's default currency first, then the rest of USDT / IDR / PHP. */
export function fiatOrder(def: Fiat): Fiat[] {
  const base: Fiat[] = ["usdt", "idr", "php"];
  return def === "usd" ? ["usd", ...base] : [def, ...base.filter((f) => f !== def)];
}

type Src = { field: "token" | Fiat; raw: string };

/**
 * Two-way converter: type a token amount and see USDT/IDR/PHP, or type in any fiat field and get the
 * token amount. Prices come from /api/prices (server cache, CoinGecko → DefiLlama fallback).
 */
export function Converter({ compact }: { compact?: boolean }) {
  const profile = useProfile();
  const pid = profile.data?.id ?? "default";
  const def: Fiat = profile.data?.fiat ?? (pid === "p2" ? "php" : "idr");
  const [coin, setCoin] = useState<PickedCoin>(ETH);
  const [src, setSrc] = useState<Src>({ field: "token", raw: "1" });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!profile.data) return;
    try {
      const s = JSON.parse(localStorage.getItem(STORE(pid)) ?? "null") as { coin?: PickedCoin } | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore last token once per profile
      if (s?.coin?.id) setCoin(s.coin);
    } catch {}
    setLoaded(true);
  }, [pid, profile.data]);
  useEffect(() => {
    if (loaded) localStorage.setItem(STORE(pid), JSON.stringify({ coin }));
  }, [coin, pid, loaded]);

  const prices = usePrices([coin.id]);
  const q = prices.data?.[coin.id];
  const fiats = compact ? [def] : fiatOrder(def);
  const extra = compact ? fiatOrder(def).filter((f) => f !== def) : [];

  const tokenAmount = useMemo(() => {
    const n = parseAmount(src.raw);
    if (src.field === "token") return n;
    if (!q || !Number.isFinite(n)) return NaN;
    const px = q[src.field];
    return px ? n / px : NaN;
  }, [src, q]);

  const display = (f: "token" | Fiat) => {
    if (src.field === f) return src.raw;
    if (!Number.isFinite(tokenAmount)) return "";
    if (f === "token") return fmtInput(tokenAmount, 8);
    return q ? fmtInput(tokenAmount * q[f], FIAT_META[f].decimals) : "";
  };

  const unit = q ? q[def] : null;
  return (
    <div className={cn("space-y-2.5", !compact && "max-w-xl")}>
      <div className="flex items-center gap-2">
        <TokenPicker value={coin} onChange={(c) => { setCoin(c); }} className={compact ? "w-[124px] shrink-0" : "w-[46%] shrink-0 sm:w-[220px]"} compact={compact} />
        <AmountInput label={coin.symbol} value={display("token")} onChange={(raw) => setSrc({ field: "token", raw })} active={src.field === "token"} />
      </div>
      {!compact && <div className="flex justify-center text-faint"><ArrowRightLeft className="h-3.5 w-3.5 rotate-90" /></div>}
      <div className={cn("grid gap-2", !compact && "sm:grid-cols-1")}>
        {fiats.map((f) => (
          <AmountInput key={f} label={FIAT_META[f].label} value={display(f)} onChange={(raw) => setSrc({ field: f, raw })} active={src.field === f} loading={prices.isLoading} />
        ))}
      </div>
      {compact && Number.isFinite(tokenAmount) && q && (
        <div className="num flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-muted">
          {extra.map((f) => <span key={f}>{money(tokenAmount * q[f], f)}</span>)}
        </div>
      )}
      <div className="flex min-h-[20px] flex-wrap items-center justify-between gap-2 text-[12px] text-faint">
        {prices.isLoading ? (
          <Skeleton className="h-4 w-40" />
        ) : prices.error ? (
          <span className="text-neg">Prices unavailable right now</span>
        ) : q ? (
          <span className="flex min-w-0 items-center gap-1.5">
            <CoinGlyph coin={coin} size={14} />
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={`${coin.id}-${unit}`} className="num truncate" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
                1 {coin.symbol} = {money(unit, def)}
              </motion.span>
            </AnimatePresence>
            {q.change24h != null && <span className={cn("num", q.change24h >= 0 ? "text-pos" : "text-neg")}>{q.change24h >= 0 ? "+" : "−"}{Math.abs(q.change24h).toFixed(2)}%</span>}
            {q.stale && <span className="text-[var(--t-amber-fg)]">· cached</span>}
          </span>
        ) : (
          <span>No price for this token on CoinGecko</span>
        )}
        <span className="flex items-center gap-2">
          {!compact && q && <span className="num">{new Date(q.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {q.source === "coingecko" ? "CoinGecko" : "DefiLlama"}</span>}
          <button type="button" onClick={() => prices.refetch()} className="rounded p-0.5 hover:text-ink" aria-label="Refresh price"><RefreshCw className={cn("h-3 w-3", prices.isFetching && "animate-spin")} /></button>
          {compact && <Link href="/prices" className="flex items-center gap-0.5 hover:text-ink">Open <ArrowUpRight className="h-3 w-3" /></Link>}
        </span>
      </div>
    </div>
  );
}

function AmountInput({ label, value, onChange, active, loading }: { label: string; value: string; onChange: (v: string) => void; active: boolean; loading?: boolean }) {
  return (
    <label className={cn("flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md border bg-panel px-2.5 transition-colors focus-within:border-line-strong focus-within:ring-2 focus-within:ring-[var(--ring)] sm:h-9", active ? "border-line-strong" : "border-line")}>
      <span className="w-12 shrink-0 font-label text-[11px] font-medium uppercase tracking-[0.1em] text-muted">{label.slice(0, 6)}</span>
      <input
        inputMode="decimal"
        autoComplete="off"
        value={loading && !active ? "" : value}
        placeholder={loading && !active ? "…" : "0"}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => e.target.select()}
        className="num min-w-0 flex-1 bg-transparent text-right text-[16px] text-ink outline-none placeholder:text-faint no-ring sm:text-[14px]"
      />
    </label>
  );
}
