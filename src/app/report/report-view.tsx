"use client";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Printer } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Button, Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { today as todayFn } from "@/lib/dates";
import { money } from "@/lib/fiat";
import { num, pct, shortAddr, tone, usd } from "@/lib/format";
import { api } from "@/lib/client/api";
import type { MonthlyReport } from "@/lib/server/report";

function monthsBack(n: number) {
  const [y, m] = todayFn().split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}
const label = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

/** Printable monthly report (Print → Save as PDF). Lives outside the app shell so the page prints clean. */
export function ReportView() {
  const sp = useSearchParams();
  const router = useRouter();
  const months = monthsBack(12);
  const month = sp.get("month") && /^\d{4}-\d{2}$/.test(sp.get("month")!) ? sp.get("month")! : months[0];
  const q = useQuery({ queryKey: ["report", month], queryFn: () => api<MonthlyReport>(`/api/reports?month=${month}`) });
  const r = q.data;
  // Print in light colours even when the app is in dark mode.
  useEffect(() => {
    const el = document.documentElement;
    let wasDark = false;
    const before = () => { wasDark = el.classList.contains("dark"); el.classList.remove("dark"); };
    const after = () => { if (wasDark) el.classList.add("dark"); };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => { window.removeEventListener("beforeprint", before); window.removeEventListener("afterprint", after); };
  }, []);
  const local = (v: number | null | undefined) => (r && v != null && r.fx.usdTo != null && r.fx.fiat !== "usd" ? money(v * r.fx.usdTo, r.fx.fiat, { compact: true }) : null);

  return (
    <div className="min-h-dvh bg-bg pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] print:bg-white print:p-0">
      <div className="mx-auto max-w-[900px] px-4 py-6 sm:px-8 print:max-w-none print:px-0 print:py-0">
        <div className="mb-6 flex flex-wrap items-center gap-2 print:hidden">
          <Link href="/portfolio"><Button variant="ghost" size="sm"><ArrowLeft className="h-3.5 w-3.5" /> Back</Button></Link>
          <select value={month} onChange={(e) => router.replace(`/report?month=${e.target.value}`)} className="h-9 rounded-md border border-line bg-panel px-2 text-[16px] text-ink sm:h-8 sm:text-[13px]" aria-label="Month">
            {months.map((m) => <option key={m} value={m}>{label(m)}</option>)}
          </select>
          <div className="ml-auto flex gap-2">
            <a href={`/api/reports?month=${month}&format=csv`}><Button size="sm"><Download className="h-3.5 w-3.5" /> CSV</Button></a>
            <Button size="sm" variant="primary" onClick={() => window.print()} disabled={!r}><Printer className="h-3.5 w-3.5" /> Print / PDF</Button>
          </div>
        </div>

        {q.isLoading ? (
          <Skeleton className="h-96" />
        ) : q.error || !r ? (
          <div className="rounded-lg border border-line px-4 py-3 text-[13px] text-neg">{(q.error as Error)?.message ?? "Report unavailable"}</div>
        ) : (
          <article className="report text-ink print:text-black">
            <header className="mb-6 border-b border-line pb-4">
              <div className="font-label text-[11px] font-medium uppercase tracking-[0.14em] text-muted">farmOS · monthly report</div>
              <h1 className="mt-1 font-serif text-[34px] leading-tight">{label(r.month)}</h1>
              <p className="num mt-1 text-[12.5px] text-muted">{r.profile.name} · {r.range.start} → {r.range.end} · {r.profile.tz} · generated {new Date(r.generatedAt).toLocaleString()}</p>
            </header>

            <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4 print:grid-cols-4">
              <Kpi k="Wallets" v={usd(r.totals.walletsUsd)} sub={local(r.totals.walletsUsd) ?? (r.totals.walletsAt ? `as of ${r.totals.walletsAt.slice(0, 10)}` : undefined)} />
              <Kpi k="Net PnL" v={usd(r.totals.net, { sign: true })} cls={tone(r.totals.net)} sub={local(r.totals.net) ?? undefined} />
              <Kpi k="Earned this month" v={usd(r.totals.earnedMonthAtClaim)} sub={`now ${usd(r.totals.earnedMonthNow)}`} />
              <Kpi k="Tasks" v={`${r.totals.tasksDone}/${r.totals.tasksDue}`} sub={r.totals.tasksDue ? `${Math.round((r.totals.tasksDone / r.totals.tasksDue) * 100)}% done` : "none due"} />
            </div>

            <Block title="Portfolio snapshot">
              <Table head={["Project", "Status", "Invested", "Realized", "Net", "ROI", "Earned (now)"]} align="rrrrr" rows={r.portfolio.map((p) => [p.project, p.status, usd(p.invested), usd(p.realized), <span key="n" className={tone(p.net)}>{usd(p.net, { sign: true })}</span>, pct(p.roi), usd(p.earnedNow)])} empty="No projects yet." />
            </Block>

            <Block title="Claimed airdrops & earnings">
              <Table head={["Date", "Project", "Token", "Amount", "At claim", "Now"]} align="rrr" rows={r.earnings.map((e) => [e.date, e.project, e.symbol, num(e.amount, 6), usd(e.valueAtClaimUsd), usd(e.currentUsd)])} empty="Nothing claimed this month." />
            </Block>

            <Block title="Tasks">
              <Table head={["Task", "Project", "Cadence", "Due", "Done", "Rate"]} align="rrr" rows={r.tasks.map((t) => [t.task, t.project, t.cadence, String(t.due), String(t.done), t.rate == null ? "—" : `${Math.round(t.rate * 100)}%`])} empty="No recurring tasks." />
            </Block>

            {r.wallets.length > 0 && (
              <Block title="Wallets">
                <Table head={["Label", "Address", "Balance"]} align="r" rows={r.wallets.map((w) => [w.label || "—", <span key="a" className="num">{shortAddr(w.address)}</span>, usd(w.usd)])} />
              </Block>
            )}
            <p className="mt-8 text-[11px] text-faint">Values in USD{r.fx.usdTo && r.fx.fiat !== "usd" ? `; 1 USD ≈ ${money(r.fx.usdTo, r.fx.fiat)} at generation` : ""}. Wallet balances are the last cached snapshot.</p>
          </article>
        )}
      </div>
    </div>
  );
}

function Kpi({ k, v, sub, cls }: { k: string; v: string; sub?: string; cls?: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel px-3 py-2.5 print:break-inside-avoid print:border-neutral-300 print:bg-white">
      <div className="font-label text-[10px] font-medium uppercase tracking-[0.14em] text-muted">{k}</div>
      <div className={cn("num mt-0.5 text-[20px] leading-tight", cls)}>{v}</div>
      {sub && <div className="num text-[11px] text-faint">{sub}</div>}
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-8 print:break-inside-avoid-page">
      <h2 className="mb-2 font-label text-[11.5px] font-medium uppercase tracking-[0.14em] text-muted">{title}</h2>
      {children}
    </section>
  );
}

/** align: one char per trailing column ("r" = right-aligned numbers), counted from the right. */
function Table({ head, rows, align = "", empty }: { head: string[]; rows: ReactNode[][]; align?: string; empty?: string }) {
  const right = (i: number) => i >= head.length - align.length;
  if (!rows.length) return <div className="rounded-lg border border-dashed border-line px-3 py-3 text-[13px] text-muted print:border-neutral-300">{empty ?? "Nothing here."}</div>;
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-panel print:overflow-visible print:border-neutral-300 print:bg-white">
      <table className="w-full min-w-[520px] border-collapse text-[12.5px] print:min-w-0">
        <thead>
          <tr>{head.map((h, i) => <th key={h} className={cn("h-8 whitespace-nowrap px-2.5 text-left text-[11.5px] font-medium text-muted", right(i) && "text-right")}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, j) => (
            <tr key={j} className="border-t border-line print:border-neutral-200">
              {r.map((c, i) => <td key={i} className={cn("h-8 px-2.5 align-middle", right(i) && "num text-right", i === 0 && "font-medium")}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
