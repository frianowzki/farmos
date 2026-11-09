import { CATEGORIES, PRIORITIES, RISKS, STATUSES, TIERS } from "./constants";

const CAT_TONE: Record<string, string> = { airdrop: "amber", testnet: "blue", nft: "violet", degen: "red" };
const PRI_TONE: Record<string, string> = { low: "gray", medium: "blue", high: "amber", urgent: "red" };
const TIER_TONE: Record<string, string> = { S: "amber", A: "green", B: "blue", C: "gray" };
const RISK_TONE: Record<string, string> = { low: "green", medium: "amber", high: "red", extreme: "red" };

export const CATEGORY_OPTS = CATEGORIES.map((c) => ({ ...c, tone: CAT_TONE[c.id] }));
export const STATUS_OPTS = STATUSES.map((s) => ({ id: s.id, label: s.label, tone: s.tone as string }));
export const PRIORITY_OPTS = PRIORITIES.map((p) => ({ ...p, tone: PRI_TONE[p.id] }));
export const TIER_OPTS = TIERS.map((t) => ({ id: t.id, label: t.id, long: t.label, tone: TIER_TONE[t.id] }));
export const RISK_OPTS = RISKS.map((r) => ({ ...r, tone: RISK_TONE[r.id] }));

export const catTone = (c: string) => CAT_TONE[c] ?? "gray";
export const statusTone = (s: string) => STATUS_OPTS.find((x) => x.id === s)?.tone ?? "gray";

const MONO = ["amber", "blue", "green", "violet", "red", "stone"];
export function monoTone(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return MONO[h % MONO.length];
}
