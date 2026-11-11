import { describe, expect, it } from "vitest";
import { costTotals, ledgerRoi } from "@/components/costs";
import { earningTotals } from "@/components/earnings";

/** Minimal cost row — costTotals only reads these fields. */
const cost = (over: Partial<{ type: string; valueAtEntry: number | null; currentUsd: number | null; projectId: string }> = {}) => ({
  id: "c",
  projectId: "p1",
  type: "gas",
  symbol: "ETH",
  coinId: null,
  chain: null,
  amount: 1,
  valueAtEntry: 10,
  currentUsd: null,
  spentAt: "2026-01-01",
  note: null,
  wallet: null,
  priceUsd: null,
  ...over,
}) as never;

const earn = (over: Partial<{ valueAtClaim: number | null; currentUsd: number | null; projectId: string }> = {}) => ({
  id: "e",
  projectId: "p1",
  symbol: "TOK",
  coinId: null,
  amount: 100,
  valueAtClaim: 50,
  currentUsd: null,
  claimedAt: "2026-01-01",
  wallet: null,
  note: null,
  priceUsd: null,
  ...over,
}) as never;

describe("costTotals", () => {
  it("sums spend and splits it by type", () => {
    const t = costTotals([cost({ type: "gas", valueAtEntry: 10 }), cost({ type: "capital", valueAtEntry: 100 }), cost({ type: "other", valueAtEntry: 5 })]);
    expect(t.spent).toBe(115);
    expect(t.gas).toBe(10);
    expect(t.capital).toBe(100);
    expect(t.other).toBe(5);
  });

  it("falls back to live value when entry value is missing", () => {
    const t = costTotals([cost({ valueAtEntry: null, currentUsd: 42 })]);
    expect(t.spent).toBe(42);
  });

  it("groups by project", () => {
    const t = costTotals([cost({ projectId: "a", valueAtEntry: 10 }), cost({ projectId: "b", valueAtEntry: 90 })]);
    expect(t.byProject.get("a")?.spent).toBe(10);
    expect(t.byProject.get("b")?.spent).toBe(90);
  });

  it("returns zeroes for an empty ledger", () => {
    const t = costTotals([]);
    expect(t).toMatchObject({ spent: 0, gas: 0, capital: 0, other: 0, now: 0 });
  });
});

describe("earningTotals", () => {
  it("sums claim value and current value", () => {
    const t = earningTotals([earn({ valueAtClaim: 50, currentUsd: 80 }), earn({ valueAtClaim: 20, currentUsd: 10 })]);
    expect(t.claim).toBe(70);
    expect(t.now).toBe(90);
  });

  it("falls back to claim value when no live price", () => {
    const t = earningTotals([earn({ valueAtClaim: 50, currentUsd: null })]);
    expect(t.now).toBe(50);
  });
});

describe("ledgerRoi", () => {
  it("computes (earned − spent) / spent", () => {
    expect(ledgerRoi(100, 150)).toBeCloseTo(0.5);
    expect(ledgerRoi(100, 50)).toBeCloseTo(-0.5);
  });

  it("is null when nothing was spent — never divide by zero", () => {
    expect(ledgerRoi(0, 500)).toBeNull();
    expect(ledgerRoi(0, 0)).toBeNull();
  });
});
