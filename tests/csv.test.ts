import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("quotes, encodes json and dates", () => {
    const csv = toCsv([{ a: 'x,"y"', b: ["c"], d: new Date("2026-01-01T00:00:00Z"), e: null, n: -5 }], ["a", "b", "d", "e", "n"]);
    expect(csv).toBe('a,b,d,e,n\r\n"x,""y""","[""c""]",2026-01-01T00:00:00.000Z,,-5\r\n');
  });
  it("neutralises formulas", () => {
    expect(toCsv([{ a: "=HYPERLINK(1)" }])).toBe("a\r\n'=HYPERLINK(1)\r\n");
  });
});
