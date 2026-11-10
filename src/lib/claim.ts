import type { AirdropChecker, Project } from "@/db/schema";
import { diffDays } from "./dates";

export type ClaimBadge = { id: "claimed" | "open" | "eligible" | "upcoming" | "not_eligible" | "closed" | "watching"; label: string; tone: string };

const B: Record<ClaimBadge["id"], ClaimBadge> = {
  claimed: { id: "claimed", label: "Claimed", tone: "gray" },
  open: { id: "open", label: "Claim open", tone: "green" },
  eligible: { id: "eligible", label: "Eligible", tone: "green" },
  upcoming: { id: "upcoming", label: "Claim soon", tone: "amber" },
  not_eligible: { id: "not_eligible", label: "Not eligible", tone: "red" },
  closed: { id: "closed", label: "Claim closed", tone: "gray" },
  watching: { id: "watching", label: "Watching claim", tone: "blue" },
};

/**
 * One badge summarising a project's claim: manual status wins, then live signals (claim page live,
 * checker results), then key dates. Null when nothing about a claim is configured.
 */
export function claimBadge(p: Pick<Project, "status" | "eligibility" | "keyDates"> & { checker?: AirdropChecker | null }, today: string): ClaimBadge | null {
  const c = p.checker ?? null;
  const manual = c?.claimStatus;
  if (manual === "claimed") return B.claimed;
  if (manual === "closed") return B.closed;
  const end = p.keyDates?.claimEnd;
  const start = p.keyDates?.claimStart;
  if (end && diffDays(end, today) < 0 && manual !== "open") return B.closed;
  const results = c?.lastRun?.results ?? [];
  const eligible = results.some((r) => r.status === "eligible");
  const live = manual === "open" || p.status === "claimable" || Boolean(c?.alerts?.openAt) || (start && diffDays(start, today) <= 0);
  if (live) return eligible || p.eligibility === "eligible" || !c || c.type === "page" || c.type === "manual" ? B.open : results.length && results.every((r) => r.status === "not_eligible") ? B.not_eligible : B.open;
  if (eligible) return B.eligible;
  if (results.length && results.every((r) => r.status === "not_eligible")) return B.not_eligible;
  if (manual === "upcoming" || (start && diffDays(start, today) > 0)) return B.upcoming;
  if (c) return B.watching;
  return null;
}
