export function usd(v: number | null | undefined, opts: { sign?: boolean; compact?: boolean } = {}) {
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  const s = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: opts.compact && abs >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: abs < 1 && abs > 0 ? 4 : 2,
  }).format(abs);
  if (v < 0) return `−${s}`;
  if (opts.sign && v > 0) return `+${s}`;
  return s;
}

export function pct(v: number | null | undefined, sign = true) {
  if (v == null || !Number.isFinite(v)) return "—";
  const s = `${Math.abs(v * 100).toFixed(Math.abs(v) < 0.1 ? 1 : 0)}%`;
  if (v < 0) return `−${s}`;
  return sign && v > 0 ? `+${s}` : s;
}

export function num(v: number | null | undefined, max = 6) {
  if (v == null || !Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: max }).format(v);
}

export function shortAddr(a?: string | null) {
  if (!a) return "";
  return a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

export function tone(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v) || v === 0) return "text-muted";
  return v > 0 ? "text-pos" : "text-neg";
}

export function relDay(day: string, todayDay: string) {
  const a = new Date(day + "T00:00:00");
  const b = new Date(todayDay + "T00:00:00");
  const d = Math.round((a.getTime() - b.getTime()) / 86_400_000);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d === -1) return "Yesterday";
  if (d > 1 && d < 7) return `In ${d} days`;
  if (d < -1 && d > -7) return `${-d} days ago`;
  return new Date(day + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
