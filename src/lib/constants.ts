export const CATEGORIES = [
  { id: "airdrop", label: "Airdrop" },
  { id: "testnet", label: "Testnet" },
  { id: "nft", label: "NFT" },
  { id: "degen", label: "Degen" },
] as const;
export type CategoryId = (typeof CATEGORIES)[number]["id"];

export const STATUSES = [
  { id: "research", label: "Research", tone: "gray" },
  { id: "active", label: "Active", tone: "blue" },
  { id: "waiting", label: "Waiting", tone: "amber" },
  { id: "claimable", label: "Claimable", tone: "blue" },
  { id: "done", label: "Done", tone: "stone" },
  { id: "dropped", label: "Dropped", tone: "red" },
] as const;
export type StatusId = (typeof STATUSES)[number]["id"];

export const PRIORITIES = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "urgent", label: "Urgent" },
] as const;

export const TIERS = [
  { id: "S", label: "S · Must farm" },
  { id: "A", label: "A · Strong" },
  { id: "B", label: "B · Decent" },
  { id: "C", label: "C · Spec" },
] as const;

export const ELIGIBILITY = [
  { id: "unknown", label: "Unknown" },
  { id: "checking", label: "Checking" },
  { id: "eligible", label: "Eligible" },
  { id: "not_eligible", label: "Not eligible" },
] as const;

export const RISKS = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "extreme", label: "Extreme" },
] as const;

export const KEY_DATES = [
  { id: "snapshot", label: "Snapshot" },
  { id: "tge", label: "TGE" },
  { id: "mint", label: "Mint" },
  { id: "claimStart", label: "Claim opens" },
  { id: "claimEnd", label: "Claim closes" },
] as const;

export const LINK_FIELDS = [
  { id: "site", label: "Website" },
  { id: "x", label: "X" },
  { id: "discord", label: "Discord" },
  { id: "telegram", label: "Telegram" },
  { id: "docs", label: "Docs" },
  { id: "explorer", label: "Explorer" },
  { id: "galxe", label: "Quests" },
  { id: "other", label: "Other" },
] as const;

/** Chains offered in selectors: exactly the supported list in lib/chain-meta. */
export { CHAIN_NAMES as CHAIN_SUGGESTIONS } from "./chain-meta";

export function label<T extends readonly { id: string; label: string }[]>(list: T, id: string) {
  return list.find((x) => x.id === id)?.label ?? id;
}
