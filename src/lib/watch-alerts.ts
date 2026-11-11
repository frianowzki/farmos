/**
 * Pure watchlist alert logic, kept out of the React component so it can be unit-tested
 * (and so the Today panel and the /watchlist page always agree on what counts as "fired").
 */

/** Minimal shape both the panel and the full page need — deliberately structural, not the DB row. */
export type AlertRow = {
  coinId: string;
  above: number | null;
  below: number | null;
  alertState?: { above?: string | null; below?: string | null } | null;
};

export type PriceLite = { usd?: number } | undefined;

/** True when this side of the alert has triggered and not yet been re-armed. */
export function fired(row: AlertRow, side: "above" | "below", price: number | null | undefined): boolean {
  if (price == null) return false;
  if (row.alertState?.[side]) return false;
  const threshold = row[side];
  if (threshold == null) return false;
  return side === "above" ? price >= threshold : price <= threshold;
}

/** Rows with at least one side fired — the ones worth surfacing first. */
export function firedAlerts<T extends AlertRow>(rows: T[], prices: Record<string, PriceLite>): T[] {
  return rows.filter((r) => {
    const p = prices[r.coinId]?.usd;
    return fired(r, "above", p) || fired(r, "below", p);
  });
}

/** Human label for the row state badge. */
export function alertStateLabel(row: AlertRow, price: number | null | undefined): "fired" | "armed" | "none" {
  if (row.above == null && row.below == null) return "none";
  return fired(row, "above", price) || fired(row, "below", price) ? "fired" : "armed";
}
