import { encodeAbiParameters, getAddress, isAddress, keccak256, type Hex } from "viem";

export type Row = Record<string, unknown>;
const num = (v: unknown) => BigInt(String(v ?? 0));

/** SeaDrop leaf = keccak256(abi.encode(minter, MintParams)); tree uses sorted pairs, odd node carried up. */
export function seadropLeaf(r: Row): Hex | null {
  const a = String(r.address ?? r.minter ?? r.wallet ?? "");
  if (!isAddress(a)) return null;
  const m = (r.mintParams ?? r.mint_params ?? r) as Row;
  try {
    return keccak256(
      encodeAbiParameters(
        [{ type: "address" }, { type: "tuple", components: ["mintPrice", "maxTotalMintableByWallet", "startTime", "endTime", "dropStageIndex", "maxTokenSupplyForStage", "feeBps"].map((n) => ({ name: n, type: "uint256" })).concat([{ name: "restrictFeeRecipients", type: "bool" }]) }],
        [getAddress(a), { mintPrice: num(m.mintPrice), maxTotalMintableByWallet: num(m.maxTotalMintableByWallet), startTime: num(m.startTime), endTime: num(m.endTime), dropStageIndex: num(m.dropStageIndex), maxTokenSupplyForStage: num(m.maxTokenSupplyForStage), feeBps: num(m.feeBps), restrictFeeRecipients: Boolean(m.restrictFeeRecipients) } as never],
      ),
    );
  } catch {
    return null;
  }
}

export function merkleRoot(leaves: Hex[]): Hex | null {
  if (!leaves.length) return null;
  let layer = leaves.map((l) => l.toLowerCase() as Hex);
  while (layer.length > 1) {
    const next: Hex[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      if (i + 1 >= layer.length) next.push(layer[i]);
      else {
        const [x, y] = [layer[i], layer[i + 1]].sort();
        next.push(keccak256(`0x${x.slice(2)}${y.slice(2)}`));
      }
    }
    layer = next;
  }
  return layer[0];
}

