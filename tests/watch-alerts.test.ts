import { describe, expect, it } from "vitest";
import { alertStateLabel, fired, firedAlerts, type AlertRow } from "@/lib/watch-alerts";

const row = (over: Partial<AlertRow> = {}): AlertRow => ({
  coinId: "ethereum",
  above: null,
  below: null,
  alertState: null,
  ...over,
});

describe("fired", () => {
  it("fires when price reaches an 'above' threshold", () => {
    expect(fired(row({ above: 3000 }), "above", 3000)).toBe(true);
    expect(fired(row({ above: 3000 }), "above", 3100)).toBe(true);
    expect(fired(row({ above: 3000 }), "above", 2999)).toBe(false);
  });

  it("fires when price drops to a 'below' threshold", () => {
    expect(fired(row({ below: 2000 }), "below", 2000)).toBe(true);
    expect(fired(row({ below: 2000 }), "below", 1800)).toBe(true);
    expect(fired(row({ below: 2000 }), "below", 2001)).toBe(false);
  });

  it("does not re-fire a side that is already marked as alerted", () => {
    const r = row({ above: 3000, alertState: { above: "3100" } });
    expect(fired(r, "above", 3200)).toBe(false);
    // the other side is independent
    expect(fired({ ...r, below: 1000 }, "below", 900)).toBe(true);
  });

  it("treats a missing or unknown price as not fired, never as zero", () => {
    expect(fired(row({ below: 2000 }), "below", null)).toBe(false);
    expect(fired(row({ below: 2000 }), "below", undefined)).toBe(false);
  });

  it("does nothing when the threshold was never set", () => {
    expect(fired(row(), "above", 999_999)).toBe(false);
    expect(fired(row(), "below", 0)).toBe(false);
  });
});

describe("firedAlerts", () => {
  const prices = { ethereum: { usd: 3200 }, solana: { usd: 140 }, bitcoin: { usd: 60_000 } };

  it("returns only rows with a live trigger", () => {
    const rows = [
      row({ coinId: "ethereum", above: 3000 }), // fires
      row({ coinId: "solana", above: 200 }), // above threshold, not crossed
      row({ coinId: "bitcoin", below: 70_000 }), // fires
    ];
    expect(firedAlerts(rows, prices).map((r) => r.coinId)).toEqual(["ethereum", "bitcoin"]);
  });

  it("skips rows with no price at all", () => {
    const rows = [row({ coinId: "ghost", above: 1 })];
    expect(firedAlerts(rows, prices)).toEqual([]);
  });

  it("skips rows that are armed but not triggered", () => {
    const rows = [row({ coinId: "ethereum", above: 5000, below: 1000 })];
    expect(firedAlerts(rows, prices)).toEqual([]);
  });

  it("returns an empty list for an empty watchlist", () => {
    expect(firedAlerts([], prices)).toEqual([]);
  });
});

describe("alertStateLabel", () => {
  it("says none when no threshold exists", () => {
    expect(alertStateLabel(row(), 100)).toBe("none");
  });
  it("says armed while waiting", () => {
    expect(alertStateLabel(row({ above: 5000 }), 3000)).toBe("armed");
  });
  it("says fired once crossed", () => {
    expect(alertStateLabel(row({ above: 3000 }), 3500)).toBe("fired");
  });
});
