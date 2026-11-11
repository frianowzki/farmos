"use client";
import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Coins, Flame, Landmark, Receipt, Wallet as WalletIcon } from "lucide-react";
import { PageHeader } from "@/components/shell";
import { Empty, Pill, SectionTitle, Skeleton } from "@/components/ui";
import { costTotals, ledgerRoi, useCosts } from "@/components/costs";
import { earningTotals, useEarnings } from "@/components/earnings";
import { useProjects } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import { pct, usd } from "@/lib/format";

type Tab = "all" | "earnings" | "costs";

/** One ledger line, normalised from either an earning or a cost. */
type Line = {
  id: string;
  kind: "earning" | "cost";
  day: string;
  projectId: string;
  projectName: string;
  symbol: string;
  amount: number;
  value: number;
  now: number | null;
  detail: string | null;
};

export function MoneyView() {
  const earn = useEarnings();
  const cost = useCosts();
  const projects = useProjects();
  const [tab, setTab] = useState<Tab>("all");
  const [month, setMonth] = useState<string>("all");

  const names = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects.data?.projects ?? []) m.set(p.id, p.name);
    return m;
  }, [projects.data]);

  const earningRows = useMemo(() => earn.data ?? [], [earn.data]);
  const costRows = useMemo(() => cost.data ?? [], [cost.data]);

  const et = earningTotals(earningRows);
  const ct = costTotals(costRows);
  const net = et.now - ct.spent;
  const roi = ledgerRoi(ct.spent, et.now);

  const months = useMemo(() => {
    const set = new Set<string>();
    for (const r of earningRows) set.add(r.claimedAt.slice(0, 7));
    for (const r of costRows) set.add(r.spentAt.slice(0, 7));
    return [...set].sort().reverse();
  }, [earningRows, costRows]);

  const lines: Line[] = useMemo(() => {
    const out: Line[] = [];
    const keep = (day: string) => month === "all" || day.slice(0, 7) === month;
    if (tab !== "costs") {
      for (const r of earningRows) {
        if (!keep(r.claimedAt)) continue;
        out.push({
          id: r.id, kind: "earning", day: r.claimedAt, projectId: r.projectId,
          projectName: names.get(r.projectId) ?? "—",
          symbol: r.symbol, amount: r.amount,
          value: r.valueAtClaim ?? 0, now: r.currentUsd, detail: r.note ?? r.wallet ?? null,
        });
      }
    }
    if (tab !== "earnings") {
      for (const r of costRows) {
        if (!keep(r.spentAt)) continue;
        out.push({
          id: r.id, kind: "cost", day: r.spentAt, projectId: r.projectId,
          projectName: names.get(r.projectId) ?? "—",
          symbol: r.symbol, amount: r.amount,
          value: r.valueAtEntry ?? 0, now: r.currentUsd, detail: r.note ?? r.chain ?? null,
        });
      }
    }
    return out.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
  }, [tab, month, earningRows, costRows, names]);

  const loading = earn.isLoading || cost.isLoading;

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Money"
        subtitle="Everything you earned and everything it cost — across all projects."
        right={
          months.length > 0 ? (
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-8 rounded-md border border-line bg-panel px-2 text-[12.5px] text-ink"
              aria-label="Filter by month"
            >
              <option value="all">All time</option>
              {months.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          ) : undefined
        }
      />

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Earned (now)" value={usd(et.now)} icon={<Coins className="h-3.5 w-3.5" />} tone="pos" hint={`${earningRows.length} claim${earningRows.length === 1 ? "" : "s"}`} />
            <Stat label="Spent" value={usd(ct.spent)} icon={<Receipt className="h-3.5 w-3.5" />} tone="neg" hint={`${costRows.length} entr${costRows.length === 1 ? "y" : "ies"}`} />
            <Stat label="Net" value={usd(net)} icon={net >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />} tone={net >= 0 ? "pos" : "neg"} hint="earned − spent" />
            <Stat label="ROI" value={roi == null ? "—" : pct(roi * 100)} icon={<Landmark className="h-3.5 w-3.5" />} tone={roi == null ? "muted" : roi >= 0 ? "pos" : "neg"} hint="on spend" />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-line bg-panel p-4 lg:col-span-1">
              <SectionTitle>Cost split</SectionTitle>
              <div className="space-y-2">
                <SplitRow icon={<Flame className="h-3.5 w-3.5" />} label="Gas" value={ct.gas} total={ct.spent} />
                <SplitRow icon={<WalletIcon className="h-3.5 w-3.5" />} label="Capital" value={ct.capital} total={ct.spent} />
                <SplitRow icon={<Receipt className="h-3.5 w-3.5" />} label="Other" value={ct.other} total={ct.spent} />
              </div>
            </div>

            <div className="rounded-lg border border-line bg-panel p-4 lg:col-span-2">
              <SectionTitle>Top projects by net</SectionTitle>
              <TopProjects earnBy={et.byProject} costBy={ct.byProject} names={names} />
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-3 flex items-center gap-1.5">
              {(["all", "earnings", "costs"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[12.5px] capitalize transition-colors",
                    tab === t ? "bg-active text-ink" : "text-muted hover:bg-hover hover:text-ink",
                  )}
                >
                  {t}
                </button>
              ))}
              <span className="ml-auto text-[12px] text-faint">{lines.length} line{lines.length === 1 ? "" : "s"}</span>
            </div>

            {lines.length === 0 ? (
              <Empty
                title="No ledger entries yet"
                body="Claims and costs you record on a project show up here."
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-line bg-panel">
                <table className="w-full min-w-[760px] border-collapse">
                  <thead>
                    <tr className="text-[12px] text-muted">
                      <th className="h-8 px-3 text-left font-medium">Date</th>
                      <th className="h-8 px-2 text-left font-medium">Project</th>
                      <th className="h-8 px-2 text-left font-medium">Kind</th>
                      <th className="h-8 px-2 text-right font-medium">Amount</th>
                      <th className="h-8 px-2 text-right font-medium">Value then</th>
                      <th className="h-8 px-2 text-right font-medium">Value now</th>
                      <th className="h-8 px-3 text-left font-medium">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => {
                      const delta = l.now != null && l.value > 0 ? ((l.now - l.value) / l.value) * 100 : null;
                      return (
                        <tr key={`${l.kind}-${l.id}`} className="border-t border-line transition-colors hover:bg-hover">
                          <td className="num h-10 px-3 text-[12.5px] tabular-nums text-muted">{l.day}</td>
                          <td className="max-w-[220px] truncate px-2 text-[13px] text-ink">{l.projectName}</td>
                          <td className="px-2">
                            <Pill tone={l.kind === "earning" ? "green" : "gray"} dot>
                              {l.kind === "earning" ? "claim" : "cost"}
                            </Pill>
                          </td>
                          <td className="num px-2 text-right text-[12.5px] tabular-nums text-ink">{l.amount} {l.symbol}</td>
                          <td className={cn("num px-2 text-right text-[12.5px] tabular-nums", l.kind === "earning" ? "text-pos" : "text-neg")}>{usd(l.value, { sign: true })}</td>
                          <td className="num px-2 text-right text-[12.5px] tabular-nums text-muted">
                            {l.now == null ? "—" : (
                              <span className="inline-flex items-center gap-1">
                                {usd(l.now)}
                                {delta != null && Math.abs(delta) >= 0.05 && (
                                  <span className={delta >= 0 ? "text-pos" : "text-neg"}>{pct(delta)}</span>
                                )}
                              </span>
                            )}
                          </td>
                          <td className="max-w-[200px] truncate px-3 text-[12px] text-faint">{l.detail ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, icon, tone, hint }: { label: string; value: string; icon: React.ReactNode; tone: "pos" | "neg" | "muted"; hint?: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-3.5">
      <div className="flex items-center gap-1.5 text-[11.5px] uppercase tracking-[0.12em] text-muted">
        {icon}{label}
      </div>
      <div className={cn("num mt-1.5 text-[20px] font-medium tabular-nums", tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : "text-ink")}>{value}</div>
      {hint && <div className="mt-0.5 text-[11.5px] text-faint">{hint}</div>}
    </div>
  );
}

function SplitRow({ icon, label, value, total }: { icon: React.ReactNode; label: string; value: number; total: number }) {
  const share = total > 0 ? value / total : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-[12.5px]">
        <span className="inline-flex items-center gap-1.5 text-muted">{icon}{label}</span>
        <span className="num tabular-nums text-ink">{usd(value)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-accent/70" style={{ width: `${Math.round(share * 100)}%` }} />
      </div>
    </div>
  );
}

function TopProjects({
  earnBy,
  costBy,
  names,
}: {
  earnBy: Map<string, { now: number }>;
  costBy: Map<string, { spent: number }>;
  names: Map<string, string>;
}) {
  const ids = new Set([...earnBy.keys(), ...costBy.keys()]);
  const rows = [...ids]
    .map((id) => ({ id, name: names.get(id) ?? "—", earned: earnBy.get(id)?.now ?? 0, spent: costBy.get(id)?.spent ?? 0 }))
    .map((r) => ({ ...r, net: r.earned - r.spent }))
    .sort((a, b) => b.net - a.net)
    .slice(0, 8);

  if (rows.length === 0) return <p className="text-[12.5px] text-faint">No project has money recorded yet.</p>;

  const max = Math.max(...rows.map((r) => Math.abs(r.net)), 1);

  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-2">
          <span className="w-[38%] truncate text-[12.5px] text-ink">{r.name}</span>
          <div className="flex-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-line">
              <div
                className={cn("h-full rounded-full", r.net >= 0 ? "bg-pos/70" : "bg-neg/70")}
                style={{ width: `${Math.round((Math.abs(r.net) / max) * 100)}%` }}
              />
            </div>
          </div>
          <span className={cn("num w-24 text-right text-[12.5px] tabular-nums", r.net >= 0 ? "text-pos" : "text-neg")}>{usd(r.net, { sign: true })}</span>
        </div>
      ))}
    </div>
  );
}
