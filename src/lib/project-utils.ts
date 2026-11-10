import type { Position, Project } from "@/db/schema";
import { KEY_DATES } from "./constants";
import { diffDays } from "./dates";
import { projectPnl, type ProjectPnl } from "./pnl";

export function pnlFor(p: Project, positions: Position[]): ProjectPnl {
  return projectPnl(p, positions.filter((x) => x.projectId === p.id));
}

export type DatedEvent = { projectId: string; projectName: string; kind: string; label: string; day: string; category: string };

export function projectDates(p: Project): DatedEvent[] {
  const out: DatedEvent[] = [];
  if (p.deadline) out.push({ projectId: p.id, projectName: p.name, kind: "deadline", label: "Deadline", day: p.deadline, category: p.category });
  for (const k of KEY_DATES) {
    const d = p.keyDates?.[k.id as keyof typeof p.keyDates];
    if (d) out.push({ projectId: p.id, projectName: p.name, kind: k.id, label: k.label, day: d, category: p.category });
  }
  return out;
}

export function nextDate(p: Project, today: string): DatedEvent | null {
  const up = projectDates(p).filter((d) => diffDays(d.day, today) >= 0).sort((a, b) => a.day.localeCompare(b.day));
  return up[0] ?? null;
}

const PRI_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const TIER_RANK: Record<string, number> = { S: 0, A: 1, B: 2, C: 3 };
const STATUS_RANK: Record<string, number> = { claimable: 0, active: 1, waiting: 2, research: 3, done: 4, dropped: 5 };

export const SORTS = [
  { id: "updated", label: "Last edited" },
  { id: "next", label: "Next date" },
  { id: "priority", label: "Priority" },
  { id: "rating", label: "Rating (best first)" },
  { id: "rating-asc", label: "Rating (worst first)" },
  { id: "tier", label: "Tier" },
  { id: "status", label: "Status" },
  { id: "pnl", label: "Net PnL" },
  { id: "name", label: "Name" },
] as const;

export function sortProjects(list: Project[], by: string, today: string, pnl: (p: Project) => ProjectPnl) {
  const arr = [...list];
  const far = "9999-12-31";
  arr.sort((a, b) => {
    switch (by) {
      case "next":
        return (nextDate(a, today)?.day ?? far).localeCompare(nextDate(b, today)?.day ?? far);
      case "priority":
        return (PRI_RANK[a.priority] ?? 9) - (PRI_RANK[b.priority] ?? 9);
      case "rating":
        return (b.rating ?? 0) - (a.rating ?? 0) || (b.audit?.score ?? 0) - (a.audit?.score ?? 0);
      case "rating-asc":
        return (a.rating || 9) - (b.rating || 9);
      case "tier":
        return (TIER_RANK[a.tier] ?? 9) - (TIER_RANK[b.tier] ?? 9);
      case "status":
        return (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
      case "pnl":
        return pnl(b).net - pnl(a).net;
      case "name":
        return a.name.localeCompare(b.name);
      default:
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }
  });
  return arr;
}

/** X handle from a project's X link ("https://x.com/foo", "twitter.com/foo", "@foo" or "foo"). */
export function xHandle(link?: string | null): string | null {
  if (!link) return null;
  const s = link.trim();
  const m = s.match(/(?:x\.com|twitter\.com)\/(?:#!\/)?@?([A-Za-z0-9_]{1,15})(?:[/?#]|$)/i) ?? s.match(/^@?([A-Za-z0-9_]{1,15})$/);
  const h = m?.[1];
  if (!h || ["home", "i", "intent", "search", "share", "explore"].includes(h.toLowerCase())) return null;
  return h;
}
