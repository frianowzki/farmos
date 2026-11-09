"use client";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Monogram, Page, PageHeader } from "@/components/shell";
import { Button, Empty, Pill, SectionTitle, Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { CATEGORIES } from "@/lib/constants";
import { num, pct, tone, usd } from "@/lib/format";
import { api, keys, useProjects } from "@/lib/client/api";
import { catTone } from "@/lib/options";
import { positionPnl, sumPnl } from "@/lib/pnl";
import { pnlFor } from "@/lib/project-utils";

export function PortfolioView() {
  const { data, isLoading } = useProjects();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const projects = useMemo(() => data?.projects ?? [], [data]);
  const positions = useMemo(() => data?.positions ?? [], [data]);
  const rows = useMemo(() => projects.map((p) => ({ p, r: pnlFor(p, positions) })).filter((x) => x.r.invested > 0 || x.r.realized !== 0), [projects, positions]);
  const total = sumPnl(rows.map((x) => x.r));
  const byCat = CATEGORIES.map((c) => ({ ...c, ...sumPnl(rows.filter((x) => x.p.category === c.id).map((x) => x.r)) }));
  const maxAbs = Math.max(1, ...byCat.map((c) => Math.abs(c.net)));
  const maxInv = Math.max(1, ...byCat.map((c) => c.invested));
  const open = positions.filter((x) => x.status === "open");
  const name = (id: string) => projects.find((p) => p.id === id)?.name ?? "";

  const refresh = async () => {
    setBusy(true);
    try {
      const r = await api<{ checked: number; updated: number }>("/api/positions/refresh", { method: "POST", body: {} });
      toast.success(`Updated ${r.updated} of ${r.checked} priced positions`);
      qc.invalidateQueries({ queryKey: keys.projects });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page wide>
      <PageHeader eyebrow="Workspace" title="Portfolio" subtitle="Capital, gas, rewards and positions rolled up across every project." right={<Button size="sm" variant="ghost" onClick={refresh} disabled={busy}><RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} /> Refresh prices</Button>} />
      {isLoading ? (
        <Skeleton className="h-40" />
      ) : rows.length === 0 ? (
        <Empty title="No money tracked yet" body="Log gas, capital and rewards on a project, or add degen positions with entry prices. Totals and ROI appear here automatically." action={<Link href="/projects?cat=degen"><Button>Go to Degen</Button></Link>} />
      ) : (
        <>
          <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Big label="Net PnL" value={usd(total.net, { sign: true })} cls={tone(total.net)} sub={pct(total.roi)} subCls={tone(total.roi)} />
            <Big label="Invested" value={usd(total.invested)} />
            <Big label="Realized" value={usd(total.realized, { sign: true })} cls={tone(total.realized)} />
            <Big label="Unrealized" value={usd(total.unrealized, { sign: true })} cls={tone(total.unrealized)} />
            <Big label="Positions" value={`${total.openPositions} open`} sub={`${total.closedPositions} closed`} />
          </div>
          <div className="mb-8 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-line bg-panel p-4">
              <SectionTitle>Net PnL by category</SectionTitle>
              <div className="space-y-3">
                {byCat.map((c) => (
                  <div key={c.id} className="grid grid-cols-[72px_1fr_96px] items-center gap-3 text-[13px]">
                    <span className="text-ink-2">{c.label}</span>
                    <div className="relative h-5">
                      <div className="absolute left-1/2 top-0 h-full w-px bg-line" />
                      <div
                        className={cn("absolute top-1 h-3 rounded-sm transition-all duration-500", c.net >= 0 ? "bg-pos/80" : "bg-neg/80")}
                        style={c.net >= 0 ? { left: "50%", width: `${(c.net / maxAbs) * 50}%` } : { right: "50%", width: `${(-c.net / maxAbs) * 50}%` }}
                      />
                    </div>
                    <span className={cn("num text-right", tone(c.net))}>{usd(c.net, { sign: true, compact: true })}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-line bg-panel p-4">
              <SectionTitle>Capital at work</SectionTitle>
              <div className="space-y-3">
                {byCat.map((c) => (
                  <div key={c.id} className="grid grid-cols-[72px_1fr_96px] items-center gap-3 text-[13px]">
                    <span className="text-ink-2">{c.label}</span>
                    <div className="h-3 overflow-hidden rounded-sm bg-hover">
                      <div className={cn("h-full rounded-sm transition-all duration-500", `dot-${catTone(c.id)}`)} style={{ width: `${(c.invested / maxInv) * 100}%`, opacity: 0.75 }} />
                    </div>
                    <span className="num text-right text-ink-2">{usd(c.invested, { compact: true })}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <SectionTitle>By project</SectionTitle>
          <div className="mb-8 overflow-x-auto rounded-lg border border-line bg-panel">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead>
                <tr className="text-left text-[12px] text-muted">
                  <th className="h-8 px-3 font-medium">Project</th>
                  <th className="px-2 font-medium">Category</th>
                  <th className="px-2 text-right font-medium">Gas</th>
                  <th className="px-2 text-right font-medium">Invested</th>
                  <th className="px-2 text-right font-medium">Realized</th>
                  <th className="px-2 text-right font-medium">Unrealized</th>
                  <th className="px-2 text-right font-medium">Net</th>
                  <th className="px-3 text-right font-medium">ROI</th>
                </tr>
              </thead>
              <tbody>
                {[...rows].sort((a, b) => b.r.net - a.r.net).map(({ p, r }) => (
                  <tr key={p.id} className="border-t border-line hover:bg-hover">
                    <td className="h-10 px-3"><Link href={`/projects/${p.id}`} className="flex items-center gap-2 font-medium"><Monogram name={p.name} size={18} />{p.name}</Link></td>
                    <td className="px-2"><Pill tone={catTone(p.category)}>{CATEGORIES.find((c) => c.id === p.category)?.label}</Pill></td>
                    <td className="num px-2 text-right text-ink-2">{usd(p.costSpent)}</td>
                    <td className="num px-2 text-right text-ink-2">{usd(r.invested)}</td>
                    <td className={cn("num px-2 text-right", tone(r.realized))}>{usd(r.realized, { sign: true })}</td>
                    <td className={cn("num px-2 text-right", tone(r.unrealized))}>{usd(r.unrealized, { sign: true })}</td>
                    <td className={cn("num px-2 text-right font-medium", tone(r.net))}>{usd(r.net, { sign: true })}</td>
                    <td className={cn("num px-3 text-right", tone(r.roi))}>{pct(r.roi)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {open.length > 0 && (
            <>
              <SectionTitle>Open positions</SectionTitle>
              <div className="overflow-x-auto rounded-lg border border-line bg-panel">
                <table className="w-full min-w-[680px] text-[13px]">
                  <thead>
                    <tr className="text-left text-[12px] text-muted">
                      <th className="h-8 px-3 font-medium">Token</th>
                      <th className="px-2 font-medium">Project</th>
                      <th className="px-2 text-right font-medium">Size</th>
                      <th className="px-2 text-right font-medium">Entry</th>
                      <th className="px-2 text-right font-medium">Current</th>
                      <th className="px-2 text-right font-medium">Value</th>
                      <th className="px-3 text-right font-medium">PnL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {open.map((x) => {
                      const r = positionPnl(x);
                      return (
                        <tr key={x.id} className="border-t border-line">
                          <td className="h-10 px-3 font-medium">{x.token}<span className="ml-1.5 text-[11.5px] font-normal text-faint">{x.chain}</span></td>
                          <td className="px-2"><Link href={`/projects/${x.projectId}`} className="text-ink-2 hover:text-ink">{name(x.projectId)}</Link></td>
                          <td className="num px-2 text-right">{num(x.size)}</td>
                          <td className="num px-2 text-right">{usd(x.entryPrice)}</td>
                          <td className="num px-2 text-right">{usd(x.currentPrice)}</td>
                          <td className="num px-2 text-right">{usd(r.value)}</td>
                          <td className={cn("num px-3 text-right", tone(r.unrealized))}>{r.value == null ? "—" : `${usd(r.unrealized, { sign: true })} · ${pct(r.roi)}`}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </Page>
  );
}

function Big({ label, value, sub, cls, subCls }: { label: string; value: string; sub?: string; cls?: string; subCls?: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <div className="text-[12px] font-medium text-muted">{label}</div>
      <div className={cn("num mt-1 text-[22px] leading-tight", cls)}>{value}</div>
      {sub && <div className={cn("num mt-0.5 text-[12.5px] text-muted", subCls)}>{sub}</div>}
    </div>
  );
}
