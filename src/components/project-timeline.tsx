"use client";
import { useMemo } from "react";
import { ArrowDownLeft, ArrowUpRight, BookOpen, CalendarClock, Coins, Fuel } from "lucide-react";
import { costTotals, useCosts } from "@/components/costs";
import { useEarnings } from "@/components/earnings";
import { cn } from "@/lib/cn";
import { relDay, usd } from "@/lib/format";
import type { ProjectDetail } from "@/lib/client/api";
type Kind = "cost" | "earning" | "diary" | "position" | "date";

type Event = {
  key: string;
  day: string;
  kind: Kind;
  title: string;
  detail?: string;
  amount?: number;
  tone?: "pos" | "neg";
};

const META: Record<Kind, { icon: typeof Coins; label: string; ring: string }> = {
  cost: { icon: Fuel, label: "Cost", ring: "text-neg" },
  earning: { icon: Coins, label: "Earning", ring: "text-pos" },
  diary: { icon: BookOpen, label: "Diary", ring: "text-muted" },
  position: { icon: ArrowUpRight, label: "Position", ring: "text-muted" },
  date: { icon: CalendarClock, label: "Upcoming", ring: "text-warning" },
};

const day = (v?: string | null) => (v ? v.slice(0, 10) : "");

/**
 * One chronological read of everything attached to a project — capital spent, tokens claimed, diary
 * notes, positions and key dates. The per-tab views each answer "what is here"; this answers "what
 * happened, in order", which is the question that comes up when auditing a farm retroactively.
 */
export function ProjectTimeline({ project, detail }: { project: ProjectDetail["project"]; detail: ProjectDetail }) {
  const { data: costs } = useCosts();
  const { data: earnings } = useEarnings();
  const today = new Date().toISOString().slice(0, 10);

  const events = useMemo(() => {
    const out: Event[] = [];
    const pid = project.id;

    for (const c of costs ?? []) {
      if (c.projectId !== pid) continue;
      const v = c.valueAtEntry ?? c.currentUsd ?? 0;
      out.push({
        key: `c-${c.id}`,
        day: day(c.spentAt),
        kind: "cost",
        title: `${c.amount ?? ""} ${c.symbol ?? ""}`.trim() || c.type,
        detail: [c.type, c.chain, c.note].filter(Boolean).join(" · ") || undefined,
        amount: -v,
        tone: "neg",
      });
    }

    for (const e of earnings ?? []) {
      if (e.projectId !== pid) continue;
      const v = e.valueAtClaim ?? e.currentUsd ?? 0;
      out.push({
        key: `e-${e.id}`,
        day: day(e.claimedAt),
        kind: "earning",
        title: `${e.amount ?? ""} ${e.symbol ?? ""}`.trim() || "Claim",
        detail: [e.note, e.wallet].filter(Boolean).join(" · ") || undefined,
        amount: v,
        tone: "pos",
      });
    }

    for (const d of detail.diary) {
      out.push({
        key: `d-${d.id}`,
        day: day(d.day),
        kind: "diary",
        title: d.title || "Diary entry",
        detail: d.content ? d.content.replace(/<[^>]*>/g, " ").trim().slice(0, 120) : undefined,
      });
    }

    for (const p of detail.positions) {
      out.push({
        key: `p-${p.id}`,
        day: day(p.openedAt),
        kind: "position",
        title: `${p.token} on ${p.chain}`,
        detail: p.status === "closed" ? "closed" : "open",
        amount: p.size ? -p.size : undefined,
        tone: "neg",
      });
    }

    for (const [label, when] of Object.entries(project.keyDates ?? {})) {
      if (label === "times" || !when) continue;
      out.push({
        key: `k-${label}-${when}`,
        day: day(when as string),
        kind: "date",
        title: label.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()),
      });
    }

    return out.filter((e) => e.day).sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
  }, [costs, earnings, detail, project]);

  const totals = costTotals((costs ?? []).filter((c) => c.projectId === project.id));
  const claimed = (earnings ?? []).filter((e) => e.projectId === project.id).reduce((a, e) => a + (e.valueAtClaim ?? 0), 0);

  if (events.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line py-10 text-center text-[13px] text-muted">
        Nothing dated yet. Costs, claims, diary entries and key dates all appear here once added.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12.5px]">
        <span className="text-muted">Spent <span className="num text-neg">{usd(totals.spent)}</span></span>
        <span className="text-muted">Claimed <span className="num text-pos">{usd(claimed)}</span></span>
        <span className="text-muted">Events <span className="num text-ink">{events.length}</span></span>
      </div>

      <ol className="relative ml-1 border-l border-line pl-5">
        {events.map((e, i) => {
          const m = META[e.kind];
          const Icon = m.icon;
          const prev = events[i - 1]?.day;
          return (
            <li key={e.key} className="relative pb-4">
              {prev !== e.day && (
                <div className="num -ml-5 mb-1.5 pl-5 text-[11px] uppercase tracking-[0.1em] text-faint">{relDay(e.day, today)}</div>
              )}
              <span className="absolute -left-[26px] top-1 flex h-4 w-4 items-center justify-center rounded-full border border-line bg-panel">
                <Icon className={cn("h-2.5 w-2.5", m.ring)} />
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-[13px] font-medium text-ink">{e.title}</span>
                {e.amount != null && e.amount !== 0 && (
                  <span className={cn("num text-[12px] tabular-nums", e.tone === "pos" ? "text-pos" : "text-neg")}>
                    {e.tone === "pos" ? "+" : "−"}{usd(Math.abs(e.amount))}
                  </span>
                )}
                <span className="ml-auto shrink-0 text-[11px] text-faint">{m.label}</span>
              </div>
              {e.detail && <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-[1.5] text-muted">{e.detail}</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
