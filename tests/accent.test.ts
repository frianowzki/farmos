import { describe, expect, it } from "vitest";
import { ACCENTS, contrast, safeCustom } from "@/lib/accent";

describe("accent contrast", () => {
  it("every preset passes 4.5:1 for button text and as text, in light and dark", () => {
    for (const a of ACCENTS) {
      expect(contrast(a.light, "#ffffff"), a.id).toBeGreaterThanOrEqual(4.5);
      expect(contrast(a.light, "#fbfaf7"), a.id).toBeGreaterThanOrEqual(4.5);
      expect(contrast(a.dark, "#141311"), a.id).toBeGreaterThanOrEqual(4.5);
      expect(contrast(a.dark, "#171615"), a.id).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("custom colours are adjusted to stay readable", () => {
    for (const c of ["#ffff00", "#00ffcc", "#111111", "#ff69b4", "#808080"]) {
      const s = safeCustom(c);
      expect(contrast(s.light, "#ffffff")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(s.dark, "#141311")).toBeGreaterThanOrEqual(4.5);
    }
  });
});
