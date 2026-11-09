import { describe, expect, it } from "vitest";
import { positionPnl, projectPnl, sumPnl } from "@/lib/pnl";

describe("positionPnl", () => {
  it("computes unrealized PnL for open positions with a current price", () => {
    const r = positionPnl({ size: 100, entryPrice: 2, currentPrice: 3, exitPrice: null, status: "open" });
    expect(r.costBasis).toBe(200);
    expect(r.value).toBe(300);
    expect(r.unrealized).toBe(100);
    expect(r.realized).toBe(0);
    expect(r.roi).toBeCloseTo(0.5);
  });
  it("treats open positions without a price as unknown, not zero", () => {
    const r = positionPnl({ size: 10, entryPrice: 5, currentPrice: null, exitPrice: null, status: "open" });
    expect(r.value).toBeNull();
    expect(r.unrealized).toBe(0);
    expect(r.roi).toBeNull();
  });
  it("realizes PnL on closed positions", () => {
    const r = positionPnl({ size: 1000, entryPrice: 0.01, currentPrice: 0.5, exitPrice: 0.004, status: "closed" });
    expect(r.realized).toBeCloseTo(-6);
    expect(r.unrealized).toBe(0);
    expect(r.roi).toBeCloseTo(-0.6);
  });
});

describe("projectPnl", () => {
  it("rolls up gas, capital, rewards and positions", () => {
    const r = projectPnl({ costSpent: 20, capitalDeployed: 100, rewardsReceived: 150 }, [
      { size: 10, entryPrice: 10, currentPrice: 12, exitPrice: null, status: "open" }, // +20 unrealized, 100 cost
      { size: 5, entryPrice: 4, currentPrice: null, exitPrice: 6, status: "closed" }, // +10 realized, 20 cost
    ]);
    expect(r.invested).toBe(20 + 100 + 100 + 20);
    expect(r.realized).toBe(150 + 10);
    expect(r.unrealized).toBe(20);
    expect(r.net).toBe(160 + 20 - 20);
    expect(r.roi).toBeCloseTo(160 / 240);
    expect(r.openPositions).toBe(1);
    expect(r.closedPositions).toBe(1);
  });
  it("airdrop with only gas spent and no reward is a loss", () => {
    const r = projectPnl({ costSpent: 35, capitalDeployed: 0, rewardsReceived: 0 }, []);
    expect(r.net).toBe(-35);
    expect(r.roi).toBe(-1);
  });
  it("has null ROI when nothing invested", () => {
    expect(projectPnl({ costSpent: 0, capitalDeployed: 0, rewardsReceived: 50 }, []).roi).toBeNull();
  });
  it("sums projects and recomputes ROI on totals", () => {
    const a = projectPnl({ costSpent: 10, capitalDeployed: 0, rewardsReceived: 30 }, []);
    const b = projectPnl({ costSpent: 10, capitalDeployed: 0, rewardsReceived: 0 }, []);
    const t = sumPnl([a, b]);
    expect(t.net).toBe(10);
    expect(t.invested).toBe(20);
    expect(t.roi).toBeCloseTo(0.5);
  });
});
