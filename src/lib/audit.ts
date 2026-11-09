/** Project audit questionnaire: multi-answer questions with weights → 0–100 score. */
export type AuditOption = { id: string; label: string; weight: number };
export type AuditQuestion = { id: string; title: string; help: string; options: AuditOption[] };

export const AUDIT: AuditQuestion[] = [
  {
    id: "team",
    title: "Who is behind it?",
    help: "Pick everything that's true.",
    options: [
      { id: "doxxed", label: "Public, doxxed team", weight: 10 },
      { id: "tier1", label: "Tier-1 VC raise", weight: 12 },
      { id: "angels", label: "Known angels / builders", weight: 6 },
      { id: "anon", label: "Fully anonymous team", weight: -8 },
    ],
  },
  {
    id: "token",
    title: "Where is the token?",
    help: "Earlier is usually better for farming.",
    options: [
      { id: "none", label: "No token yet", weight: 10 },
      { id: "points", label: "Points program live", weight: 8 },
      { id: "tge", label: "TGE date announced", weight: 4 },
      { id: "live", label: "Token already trading", weight: -6 },
    ],
  },
  {
    id: "product",
    title: "What's shipped?",
    help: "Signals the team builds, not just markets.",
    options: [
      { id: "mainnet", label: "Mainnet live", weight: 8 },
      { id: "testnet", label: "Incentivised testnet", weight: 7 },
      { id: "audited", label: "Audited contracts", weight: 8 },
      { id: "opensource", label: "Open-source code", weight: 4 },
    ],
  },
  {
    id: "cost",
    title: "What does it cost to farm?",
    help: "Cheaper and capital-light scores higher.",
    options: [
      { id: "free", label: "Gas only", weight: 8 },
      { id: "deposit", label: "Needs a capital deposit", weight: -3 },
      { id: "nft", label: "Needs an NFT / pass", weight: -4 },
      { id: "paid", label: "Paid quests / fees", weight: -6 },
    ],
  },
  {
    id: "signals",
    title: "Any reward signals?",
    help: "Public, verifiable hints only.",
    options: [
      { id: "confirmed", label: "Airdrop officially confirmed", weight: 12 },
      { id: "dashboard", label: "Points / XP dashboard", weight: 6 },
      { id: "community", label: "Large, real community", weight: 4 },
      { id: "ecosystem", label: "Foundation / ecosystem grants", weight: 4 },
    ],
  },
  {
    id: "flags",
    title: "Red flags?",
    help: "Be honest; each one costs points.",
    options: [
      { id: "unaudited", label: "Unaudited deposit contract", weight: -12 },
      { id: "upfront", label: "Upfront fee to whitelist", weight: -14 },
      { id: "fork", label: "Copy-paste fork", weight: -8 },
      { id: "apr", label: "Unrealistic APR / promises", weight: -12 },
    ],
  },
];

const MAX = AUDIT.reduce((s, q) => s + q.options.filter((o) => o.weight > 0).reduce((a, o) => a + o.weight, 0), 0);
const BASE = 40;

export function auditScore(answers: Record<string, string[]>) {
  let raw = 0;
  for (const q of AUDIT) for (const id of answers[q.id] ?? []) raw += q.options.find((o) => o.id === id)?.weight ?? 0;
  return Math.max(0, Math.min(100, Math.round(BASE + (raw / MAX) * (100 - BASE))));
}

export const scoreToRating = (score: number) => Math.max(1, Math.min(5, Math.round(score / 20)));
