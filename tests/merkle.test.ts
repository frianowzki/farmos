import { describe, expect, it } from "vitest";
import { keccak256 } from "viem";
import { merkleRoot, seadropLeaf } from "@/lib/merkle";

const pair = (a: string, b: string) => {
  const [x, y] = [a.toLowerCase(), b.toLowerCase()].sort();
  return keccak256(`0x${x.slice(2)}${y.slice(2)}`);
};

describe("SeaDrop merkle helpers", () => {
  const rows = ["0x1111111111111111111111111111111111111111", "0x2222222222222222222222222222222222222222", "0x3333333333333333333333333333333333333333"].map((address) => ({
    address, mintPrice: "0", maxTotalMintableByWallet: 2, startTime: 1, endTime: 2, dropStageIndex: 1, maxTokenSupplyForStage: 100, feeBps: 1000, restrictFeeRecipients: true,
  }));
  it("hashes a leaf per wallet and rejects junk", () => {
    const l = seadropLeaf(rows[0]);
    expect(l).toMatch(/^0x[0-9a-f]{64}$/);
    expect(seadropLeaf({ ...rows[0], address: "nope" })).toBeNull();
    expect(seadropLeaf({ ...rows[0], maxTotalMintableByWallet: 3 })).not.toBe(l);
  });
  it("builds a sorted-pair root and carries the odd leaf up", () => {
    const [a, b, c] = rows.map((r) => seadropLeaf(r)!);
    expect(merkleRoot([a, b, c])).toBe(pair(pair(a, b), c));
    expect(merkleRoot([b, a, c])).toBe(merkleRoot([a, b, c]));
    expect(merkleRoot([a])).toBe(a.toLowerCase());
    expect(merkleRoot([])).toBeNull();
  });
});
