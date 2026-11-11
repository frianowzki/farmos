"use client";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightLeft, ArrowUpRight, CalendarDays, Check, Flame, ListChecks, NotebookPen, Plus, Telescope, Wallet } from "lucide-react";
import Link from "next/link";
import { LayoutGroup, motion } from "motion/react";
import { useMemo } from "react";
import { Page, useShell } from "@/components/shell";
import { ProjectMark } from "@/components/project-mark";
import { TodayHeader } from "@/components/today-header";
import { Heatmap, TaskRow, useTaskModel, weekRate } from "@/components/tasks";
import { Button, Pill, SectionTitle, Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { STATUSES } from "@/lib/constants";
import { diffDays, nowMinInZone } from "@/lib/dates";
import { relDay, relWhen, tone, usd, pct } from "@/lib/format";
import { api, useDiary, useGoogleStatus, useProfile, useProjects, type Project } from "@/lib/client/api";
import { Grid, GridItem } from "@/components/panelui/grid-item";
import { catTone } from "@/lib/options";
import { sumPnl } from "@/lib/pnl";
import { Converter } from "@/components/converter";
import { earningTotals, useEarnings } from "@/components/earnings";
import { costTotals, ledgerRoi, useCosts } from "@/components/costs";
import { pnlFor, projectDates } from "@/lib/project-utils";
import { Watchlist, firedAlerts, useWatchlist } from "@/components/watchlist";

export function TodayView() {
  const { data, isLoading } = useProjects();
  const model = useTaskModel();
  const { newProject } = useShell();
  const profile = useProfile();
  const today = model.today;

  const projects = useMemo(() => data?.projects ?? [], [data]);
  const due = model.rows.filter((r) => r.dueToday && (!r.satisfied || r.doneToday));
  const open = due.filter((r) => !r.doneToday);
  const done = due.filter((r) => r.doneToday);
  const upcoming = useMemo(
    () =>
      projects
        .filter((p) => p.status !== "done" && p.status !== "dropped")
        .flatMap(projectDates)
        .filter((d) => diffDays(d.day, today) >= -1 && diffDays(d.day, today) <= 21)
        .sort((a, b) => a.day.localeCompare(b.day))
        .slice(0, 10),
    [projects, today],
  );
  const totals = useMemo(() => sumPnl(projects.map((p) => pnlFor(p, data?.positions ?? []))), [projects, data]);
  const claimable = projects.filter((p) => p.status === "claimable");
  const activeCount = projects.filter((p) => p.status !== "done" && p.status !== "dropped").length;
  const watch = useWatchlist();
  const alertsFired = firedAlerts(watch.data?.items ?? [], watch.data?.prices ?? {}).length;
  const fresh = !isLoading && projects.length === 0 && model.rows.length === 0;

  return (
    <Page wide>
      <TodayHeader
        name={profile.data?.name ?? ""}
        line={isLoading ? "\u00a0" : fresh ? "A clean desk. Let's set it up." : (
          <>
            {open.length ? `${open.length} task${open.length > 1 ? "s" : ""} left today` : model.rows.length ? "All of today's tasks are done" : "No recurring tasks yet"}
            {upcoming.length > 0 && ` · ${upcoming.filter((u) => diffDays(u.day, today) <= 7 && diffDays(u.day, today) >= 0).length} dates this week`}
            {claimable.length > 0 && ` · ${claimable.length} claimable`}
            {alertsFired > 0 && ` · ${alertsFired} price alert${alertsFired > 1 ? "s" : ""} fired`}
          </>
        )}
      />

      {!fresh && !isLoading && <TodayKpis projects={projects} today={today} />}
      {fresh ? (
        <Onboarding onNew={() => newProject()} />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-8">
            <section>
              <SectionTitle right={<Link href="/tasks" className="text-[12px] text-muted hover:text-ink">Manage</Link>}>Today</SectionTitle>
              {model.isLoading ? (
                <Skeleton className="h-32" />
              ) : due.length === 0 ? (
                <Link href="/tasks?new=1" className="flex items-center gap-3 rounded-lg border border-dashed border-line px-4 py-5 text-[13.5px] text-muted hover:border-line-strong hover:text-ink">
                  <ListChecks className="h-4 w-4" /> Add the things you do every day: faucets, check-ins, quests, swaps.
                </Link>
              ) : (
                <div className="rounded-lg border border-line bg-panel p-1">
                  <LayoutGroup>
                    {[...open, ...done].map((r, i) => (
                      <motion.div key={r.task.id} layout="position" transition={{ type: "spring", stiffness: 420, damping: 38 }}>
                        {i === open.length && open.length > 0 && <div className="mx-2 my-1 h-px bg-line" />}
                        <TaskRow row={r} />
                      </motion.div>
                    ))}
                  </LayoutGroup>
                  <div className="px-2 pb-1 pt-2">
                    <div className="h-1 overflow-hidden rounded-full bg-hover">
                      <motion.div className="h-full origin-left rounded-full bg-accent" initial={false} animate={{ scaleX: done.length / Math.max(1, due.length) }} transition={{ type: "spring", stiffness: 200, damping: 30 }} />
                    </div>
                    <div className="mt-1.5 flex justify-between text-[11.5px] text-faint">
                      <span>{done.length} of {due.length} done</span>
                      {open.length === 0 && <span className="flex items-center gap-1 text-pos"><Check className="h-3 w-3" /> Clear</span>}
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section>
              <SectionTitle right={<Link href="/projects?view=table" className="text-[12px] text-muted hover:text-ink">All projects</Link>}>Coming up</SectionTitle>
              {upcoming.length === 0 ? (
                <div className="rounded-lg border border-dashed border-line px-4 py-5 text-[13.5px] text-muted">No deadlines, snapshots, TGEs or claim windows in the next 3 weeks.</div>
              ) : (
                <div className="divide-y divide-line rounded-lg border border-line bg-panel">
                  {upcoming.map((u) => {
                    const d = diffDays(u.day, today);
                    return (
                      <Link key={`${u.projectId}-${u.kind}`} href={`/projects/${u.projectId}`} className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-hover">
                        <div className={cn("num w-[78px] shrink-0 text-[12.5px]", d <= 1 ? "text-accent" : "text-muted")}>{relWhen(u.day, u.time, today, nowMinInZone())}</div>
                        <ProjectMark p={projects.find((x) => x.id === u.projectId) ?? { name: u.projectName }} size={20} />
                        <div className="min-w-0 flex-1 truncate text-[13.5px]">{u.projectName}</div>
                        <Pill tone={catTone(u.category)}>{u.label}</Pill>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            <CalendarSection />
          </div>

          <aside className="min-w-0 space-y-6">
            <div className="rounded-xl border border-line bg-panel p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[12px] font-medium text-muted">Streak</div>
                  <div className="mt-0.5 flex items-baseline gap-1.5">
                    <span className="num text-[34px] leading-none">{model.streak}</span>
                    <span className="text-[13px] text-muted">day{model.streak === 1 ? "" : "s"}</span>
                  </div>
                </div>
                <Flame className={cn("h-5 w-5", model.streak > 0 ? "text-accent" : "text-faint")} />
              </div>
              <div className="mt-1 text-[12px] text-faint">Active {weekRate(model.allDays, today)} of the last 7 days</div>
              <div className="mt-4"><Heatmap heat={model.heat} today={today} /></div>
            </div>

            <div className="rounded-xl border border-line bg-panel p-4">
              <div className="mb-3 flex items-center justify-between text-[12px] font-medium text-muted">Convert <ArrowRightLeft className="h-3.5 w-3.5" /></div>
              <Converter compact />
            </div>

            <div className="rounded-xl border border-line bg-panel p-4">
              <Watchlist />
            </div>

            <Link href="/portfolio" className="block rounded-xl border border-line bg-panel p-4 transition-colors hover:border-line-strong">
              <div className="flex items-center justify-between text-[12px] font-medium text-muted">Portfolio <ArrowUpRight className="h-3.5 w-3.5" /></div>
              <WalletTotal />
              <div className="mt-2 flex items-baseline gap-2 text-[12px] text-muted">
                P&amp;L <span className={cn("num text-[13px]", tone(totals.net))}>{usd(totals.net, { sign: true })}</span>
                <span className={cn("num text-[12px]", tone(totals.roi))}>{pct(totals.roi)}</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[11.5px] text-muted">
                <div>Invested<div className="num text-[13px] text-ink-2">{usd(totals.invested, { compact: true })}</div></div>
                <div>Realized<div className={cn("num text-[13px]", tone(totals.realized))}>{usd(totals.realized, { compact: true })}</div></div>
                <div>Open<div className="num text-[13px] text-ink-2">{totals.openPositions}</div></div>
              </div>
            </Link>

            <div className="rounded-xl border border-line bg-panel p-4">
              <div className="mb-3 flex items-center justify-between text-[12px] font-medium text-muted">Pipeline <span className="num text-faint">{activeCount} active</span></div>
              <div className="flex h-2 overflow-hidden rounded-full bg-hover">
                {STATUSES.filter((s) => s.id !== "dropped").map((s) => {
                  const n = projects.filter((p) => p.status === s.id).length;
                  return n ? <div key={s.id} className={`dot-${s.tone}`} style={{ width: `${(n / Math.max(1, projects.length)) * 100}%` }} title={`${s.label}: ${n}`} /> : null;
                })}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-y-1.5 text-[12.5px]">
                {STATUSES.map((s) => (
                  <Link key={s.id} href={`/projects?view=board`} className="flex items-center gap-2 text-ink-2 hover:text-ink">
                    <span className={`h-2 w-2 rounded-full dot-${s.tone}`} />
                    {s.label}
                    <span className="num ml-auto pr-4 text-faint">{projects.filter((p) => p.status === s.id).length}</span>
                  </Link>
                ))}
              </div>
            </div>

            <DiaryNudge today={today} />
          </aside>
        </div>
      )}
    </Page>
  );
}

function Onboarding({ onNew }: { onNew: () => void }) {
  const steps = [
    { n: 1, title: "Add your first project", body: "An airdrop you're farming, a testnet, a WL you're chasing or a degen play.", action: <Button variant="primary" onClick={onNew}><Plus className="h-3.5 w-3.5" /> New project</Button> },
    { n: 2, title: "Set your daily routine", body: "Faucets, check-ins, quests. Tick them here every day and keep the streak alive.", action: <Link href="/tasks?new=1"><Button><ListChecks className="h-3.5 w-3.5" /> Add a task</Button></Link> },
    { n: 3, title: "Plug in your tools", body: "Link wallets (read-only), connect Google for mail & calendar, and point the research desk at your model.", action: <div className="flex flex-wrap gap-2"><Link href="/wallets"><Button><Wallet className="h-3.5 w-3.5" /> Wallets</Button></Link><Link href="/settings"><Button><Telescope className="h-3.5 w-3.5" /> AI & Google</Button></Link></div> },
  ];
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {steps.map((s, i) => (
        <div key={s.n} className="anim-rise flex flex-col rounded-xl border border-line bg-panel p-5" style={{ animationDelay: `${i * 60}ms` }}>
          <div className="num mb-3 flex h-6 w-6 items-center justify-center rounded-full border border-line text-[12px] text-muted">{s.n}</div>
          <div className="font-serif text-[20px] leading-tight">{s.title}</div>
          <p className="mt-1.5 flex-1 text-[13.5px] text-muted">{s.body}</p>
          <div className="mt-4">{s.action}</div>
        </div>
      ))}
    </div>
  );
}

function CalendarSection() {
  const g = useGoogleStatus();
  const q = useQuery({
    queryKey: ["calendar-upcoming"],
    queryFn: () => api<{ events: { id: string; summary: string; start: string; allDay: boolean; htmlLink: string }[] }>("/api/google/calendar?days=10"),
    enabled: Boolean(g.data?.connected),
    staleTime: 120_000,
  });
  if (!g.data) return null;
  return (
    <section>
      <SectionTitle right={g.data.connected ? <span className="text-[12px] text-faint">{g.data.email}</span> : undefined}>Calendar</SectionTitle>
      {!g.data.connected ? (
        <Link href="/settings#google" className="flex items-center gap-3 rounded-lg border border-dashed border-line px-4 py-4 text-[13.5px] text-muted hover:border-line-strong hover:text-ink">
          <CalendarDays className="h-4 w-4" /> {g.data.configured ? "Connect Google Calendar to see your next events here." : "Google isn't set up yet. See Settings → Google."}
        </Link>
      ) : q.isLoading ? (
        <Skeleton className="h-24" />
      ) : q.error ? (
        <div className="rounded-lg border border-line px-4 py-3 text-[13px] text-neg">{(q.error as Error).message}</div>
      ) : (q.data?.events.length ?? 0) === 0 ? (
        <div className="rounded-lg border border-dashed border-line px-4 py-4 text-[13.5px] text-muted">Nothing on the calendar for the next 10 days.</div>
      ) : (
        <div className="divide-y divide-line rounded-lg border border-line bg-panel">
          {q.data!.events.map((e) => {
            const d = new Date(e.start.length <= 10 ? e.start + "T00:00:00" : e.start);
            return (
              <a key={e.id} href={e.htmlLink} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-3 py-2.5 hover:bg-hover">
                <div className="num w-[78px] shrink-0 text-[12.5px] text-muted">{d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                <div className="min-w-0 flex-1 truncate text-[13.5px]">{e.summary}</div>
                <div className="num text-[12px] text-faint">{e.allDay ? "All day" : d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</div>
              </a>
            );
          })}
        </div>
      )}
    </section>
  );
}

function DiaryNudge({ today }: { today: string }) {
  const { data } = useDiary();
  const last = data?.entries[0];
  const wroteToday = last?.day === today;
  return (
    <Link href={wroteToday ? `/diary?entry=${last!.id}` : "/diary?new=1"} className="block rounded-xl border border-line bg-panel p-4 transition-colors hover:border-line-strong">
      <div className="flex items-center justify-between text-[12px] font-medium text-muted">Diary <NotebookPen className="h-3.5 w-3.5" /></div>
      {last ? (
        <>
          <div className="mt-1 font-serif text-[17px] leading-snug">{last.title || (wroteToday ? "Today's note" : "Last entry")}</div>
          <p className="mt-1 line-clamp-2 text-[12.5px] text-muted">{last.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || "Empty"}</p>
          {!wroteToday && <div className="mt-2 text-[12.5px] text-accent">Write today&apos;s note →</div>}
        </>
      ) : (
        <p className="mt-1 text-[13px] text-muted">Keep a log of what you did, what you learned, and what to try next. <span className="text-accent">Start writing →</span></p>
      )}
    </Link>
  );
}

function TodayKpis({ projects, today }: { projects: Project[]; today: string }) {
  const live = projects.filter((p) => p.status !== "dropped");
  const earn = useEarnings();
  const et = earningTotals(earn.data ?? []);
  // Logged earnings win; projects with only the old "rewards received" number still count.
  const legacy = projects.filter((p) => p.rewardsReceived > 0 && !et.byProject.has(p.id));
  const paidSum = et.claim + legacy.reduce((a, p) => a + p.rewardsReceived, 0);
  const nowSum = et.now + legacy.reduce((a, p) => a + p.rewardsReceived, 0);
  const paidCount = et.byProject.size + legacy.length;
  const costs = useCosts();
  const spent = costTotals(costs.data ?? []).spent;
  const roi = ledgerRoi(spent, et.now);
  const tba = live.filter((p) => p.status !== "done" && !p.keyDates?.tge && !p.deadline);
  const incoming = live.filter((p) => p.status === "claimable" || [p.keyDates?.tge, p.keyDates?.snapshot, p.keyDates?.mint, p.deadline].some((d) => d && diffDays(d, today) >= 0 && diffDays(d, today) <= 30));
  const items = [
    { k: "Projects", v: String(live.length), sub: `${projects.filter((p) => p.status === "active").length} active`, href: "/projects" },
    { k: "Earned", v: usd(paidSum, { compact: true }), sub: roi != null ? `ROI ${pct(roi)} on ${usd(spent, { compact: true })} spent` : paidCount ? `now ${usd(nowSum, { compact: true })} · ${paidCount} project${paidCount === 1 ? "" : "s"}` : "log claims on a project", href: roi != null ? "/portfolio#ledger" : "/portfolio#earnings" },
    { k: "TBA", v: String(tba.length), sub: "no TGE or deadline yet", href: "/projects" },
    { k: "Incoming", v: String(incoming.length), sub: "claimable or due in 30d", href: "/projects" },
  ];
  return (
    <Grid className="mb-8">
      {items.map((i) => (
        <GridItem key={i.k} className="transition-colors hover:border-line-strong">
          <Link href={i.href} className="block px-4 py-3">
            <div className="font-label text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted">{i.k}</div>
            <div className="num mt-1 text-[24px] leading-tight text-ink">{i.v}</div>
            <div className="mt-0.5 text-[11.5px] text-faint">{i.sub}</div>
          </Link>
        </GridItem>
      ))}
    </Grid>
  );
}

type WalletSnap = { totalUsd: number; wallets: { address: string }[]; fetchedAt: string };
type NftSnap = { totalUsd: number | null; totalNative: { symbol: string; amount: number }[]; count: number };

/** Aggregated balance of every saved wallet (tokens + NFT floor), same snapshot as Portfolio. */
function WalletTotal() {
  const w = useQuery({ queryKey: ["wallet-track"], queryFn: () => api<WalletSnap>("/api/wallets/track"), staleTime: 5 * 60_000 });
  const n = useQuery({ queryKey: ["wallet-nfts"], queryFn: () => api<NftSnap>("/api/wallets/nfts"), staleTime: 10 * 60_000, retry: false });
  if (w.isLoading) return <Skeleton className="mt-1.5 h-8 w-32" />;
  const wallets = w.data?.wallets.length ?? 0;
  const nftUsd = n.data?.totalUsd ?? 0;
  const total = (w.data?.totalUsd ?? 0) + nftUsd;
  return (
    <div className="mt-1">
      <div className="num text-[26px] leading-tight text-ink">{wallets ? usd(total) : "—"}</div>
      <div className="text-[11.5px] text-faint">
        {wallets ? <>{wallets} wallet{wallets === 1 ? "" : "s"}{n.data?.count ? <> · {n.data.count} NFTs ≈ {usd(nftUsd, { compact: true })} floor</> : null}</> : "Add a wallet to see your balance"}
      </div>
    </div>
  );
}
