import { describe, expect, it } from "vitest";
import { familiesFor, normalizeAddress } from "@/lib/wallet-chains";
import { chainMeta } from "@/lib/chain-meta";

describe("wallet families", () => {
  it("detects NEAR named and implicit accounts", () => {
    expect(familiesFor("frio.near")).toEqual(["near"]);
    expect(familiesFor("alice.tg")).toEqual(["near"]);
    expect(familiesFor("17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1")).toEqual(["near"]);
    expect(normalizeAddress("Frio.NEAR", "near")).toBe("frio.near");
  });
  it("detects Canton party ids", () => {
    expect(familiesFor("Cumberland-1::12201aa8a23046d5740c9edd58f7e820c83e7f5c58f25551f955f3252d3a04240860")).toEqual(["canton"]);
  });
  it("keeps existing families", () => {
    expect(familiesFor("0x000000000000000000000000000000000000dEaD")).toEqual(["evm"]);
    expect(familiesFor("0x" + "a".repeat(64))).toEqual(["aptos", "sui"]);
    expect(familiesFor("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")).toEqual(["solana"]);
    expect(familiesFor("hello")).toEqual([]);
  });
  it("chain meta knows NEAR and Canton", () => {
    expect(chainMeta("near protocol")?.key).toBe("near");
    expect(chainMeta("Canton")?.name).toBe("Canton Network");
  });
});
