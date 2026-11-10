import { describe, expect, it } from "vitest";
import { parseAmount, fmtInput } from "@/lib/client/prices";
import { money, profileFiat } from "@/lib/fiat";
import { claimBadge } from "@/lib/claim";

describe("parseAmount", () => {
  it.each([
    ["1", 1], ["1.5", 1.5], ["0,5", 0.5], ["1,234.5", 1234.5], ["1.234,5", 1234.5], ["1.000.000", 1_000_000],
    ["1,000,000", 1_000_000], ["Rp 25.000.000", 25_000_000], ["12,5", 12.5], [".5", 0.5],
  ])("%s → %s", (s, n) => expect(parseAmount(s)).toBe(n));
  it("rejects junk", () => {
    expect(parseAmount("")).toBeNaN();
    expect(parseAmount("abc")).toBeNaN();
    expect(parseAmount("1-2")).toBeNaN();
  });
  it("round-trips formatted input", () => expect(parseAmount(fmtInput(1234567.891, 2))).toBe(1234567.89));
});

describe("money + profile fiat", () => {
  it("defaults: USD for both profiles", () => {
    expect(profileFiat("default")).toBe("usd");
    expect(profileFiat("p2")).toBe("usd");
  });
  it("formats", () => {
    expect(money(1500000, "idr")).toBe("Rp 1.500.000");
    expect(money(1234.5, "php")).toBe("₱1,234.5");
    expect(money(10, "usdt")).toBe("10 USDT");
  });
});

describe("claimBadge", () => {
  const base = { status: "active", eligibility: "unknown", keyDates: {} };
  it("null without config", () => expect(claimBadge(base, "2026-11-11")).toBeNull());
  it("manual claimed wins", () => expect(claimBadge({ ...base, checker: { type: "manual", claimStatus: "claimed" } }, "2026-11-11")?.id).toBe("claimed"));
  it("page live → open", () => expect(claimBadge({ ...base, checker: { type: "page", url: "https://x", alerts: { openAt: "2026-11-10" } } }, "2026-11-11")?.id).toBe("open"));
  it("eligible wallet", () => expect(claimBadge({ ...base, checker: { type: "api", lastRun: { at: "x", results: [{ wallet: "0x1", status: "eligible" }] } } }, "2026-11-11")?.id).toBe("eligible"));
  it("claim date ahead → soon", () => expect(claimBadge({ ...base, keyDates: { claimStart: "2026-11-20" } }, "2026-11-11")?.id).toBe("upcoming"));
  it("claim ended → closed", () => expect(claimBadge({ ...base, keyDates: { claimStart: "2026-10-01", claimEnd: "2026-11-01" } }, "2026-11-11")?.id).toBe("closed"));
});
