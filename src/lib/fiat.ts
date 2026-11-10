/** Currencies the converter and watchlist show. USDT is priced from Tether's live USD rate. */
export const FIATS = ["usdt", "idr", "php", "usd"] as const;
export type Fiat = (typeof FIATS)[number];
export const isFiat = (v: unknown): v is Fiat => typeof v === "string" && (FIATS as readonly string[]).includes(v);

export const FIAT_META: Record<Fiat, { label: string; symbol: string; decimals: number }> = {
  usdt: { label: "USDT", symbol: "₮", decimals: 2 },
  idr: { label: "IDR", symbol: "Rp", decimals: 0 },
  php: { label: "PHP", symbol: "₱", decimals: 2 },
  usd: { label: "USD", symbol: "$", decimals: 2 },
};

/** Iya's profile defaults to rupiah, Nadine's to peso. */
export function profileFiat(pid: string | null | undefined): Fiat {
  return pid === "p2" ? "php" : "idr";
}

export type PriceQuote = { usd: number; idr: number; php: number; usdt: number; change24h: number | null; at: string; stale?: boolean; source: string };

/** Value of one token in `fiat`. */
export function quoteIn(q: Pick<PriceQuote, "usd" | "idr" | "php" | "usdt">, fiat: Fiat): number {
  return q[fiat];
}

/** Formats a fiat amount: Rp 1.234.567, ₱1,234.50, 12.34 USDT, $0.0042. */
export function money(v: number | null | undefined, fiat: Fiat, opts: { compact?: boolean } = {}): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  const max = abs > 0 && abs < 1 ? (fiat === "idr" ? 2 : 6) : FIAT_META[fiat].decimals;
  const n = new Intl.NumberFormat(fiat === "idr" ? "id-ID" : "en-US", {
    maximumFractionDigits: max,
    minimumFractionDigits: 0,
    notation: opts.compact && abs >= 100_000 ? "compact" : "standard",
  }).format(abs);
  const sign = v < 0 ? "−" : "";
  if (fiat === "usdt") return `${sign}${n} USDT`;
  if (fiat === "idr") return `${sign}Rp ${n}`;
  return `${sign}${FIAT_META[fiat].symbol}${n}`;
}
