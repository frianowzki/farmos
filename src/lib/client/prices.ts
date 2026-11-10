"use client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { PriceQuote } from "@/lib/fiat";
import { api } from "./api";

export type CoinHit = { id: string; name: string; symbol: string; thumb: string | null; rank: number | null };

/** Live prices for CoinGecko ids (server-cached; refetched every minute). */
export function usePrices(ids: (string | null | undefined)[]) {
  const list = [...new Set(ids.filter((x): x is string => Boolean(x)))].sort();
  return useQuery({
    queryKey: ["prices", list.join(",")],
    queryFn: () => api<{ prices: Record<string, PriceQuote> }>(`/api/prices?ids=${encodeURIComponent(list.join(","))}`).then((r) => r.prices),
    enabled: list.length > 0,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function useDebounced<T>(v: T, ms = 250) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

export function useCoinSearch(q: string) {
  const dq = useDebounced(q.trim(), 250);
  return useQuery({ queryKey: ["coin-search", dq.toLowerCase()], queryFn: () => api<{ coins: CoinHit[] }>(`/api/prices/search?q=${encodeURIComponent(dq)}`).then((r) => r.coins), staleTime: 10 * 60_000 });
}

/**
 * Parses what people actually type: "1,234.5", "1.234,5", "1.000.000" (rupiah style), "0,5".
 * Returns NaN for anything else.
 */
export function parseAmount(raw: string): number {
  let s = raw.replace(/[\s_'’]/g, "").replace(/^(rp|₱|\$|₮)/i, "");
  if (!s) return NaN;
  const hasDot = s.includes("."), hasComma = s.includes(",");
  if (hasDot && hasComma) {
    const dec = s.lastIndexOf(".") > s.lastIndexOf(",") ? "." : ",";
    s = dec === "." ? s.replace(/,/g, "") : s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (hasDot && /^\d{1,3}(\.\d{3}){2,}$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  if (!/^\d*\.?\d*$/.test(s) || s === ".") return NaN;
  return Number(s);
}

/** Plain grouped number for an input (en-US grouping so it parses back unambiguously). */
export function fmtInput(v: number, maxDecimals: number): string {
  if (!Number.isFinite(v)) return "";
  const abs = Math.abs(v);
  const max = abs === 0 ? 0 : abs < 0.0001 ? 10 : abs < 1 ? Math.max(maxDecimals, 6) : maxDecimals;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: max, useGrouping: true }).format(v);
}

/** USD → USDT/IDR/PHP rates derived from Tether's live quote (1 USDT ≈ 1 USD). */
export function useFx() {
  const p = usePrices(["tether"]);
  const t = p.data?.tether;
  const rate = (f: import("@/lib/fiat").Fiat) => (f === "usd" ? 1 : !t ? null : f === "usdt" ? 1 / t.usdt : t[f] / t.usd);
  return { ready: Boolean(t), rate, toFiat: (usdValue: number | null | undefined, f: import("@/lib/fiat").Fiat) => (usdValue == null ? null : rate(f) == null ? null : usdValue * rate(f)!) };
}
