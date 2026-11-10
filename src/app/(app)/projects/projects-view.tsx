"use client";
import { Checkbox } from "@/components/motion/checkbox";
import { ProjectMark } from "@/components/project-mark";
import { ChainInline, ChainLabel } from "@/components/chain-logo";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, BadgeCheck, Trash2, CalendarClock, ChevronDown, Columns3, Filter, LayoutList, Plus, Rows3, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Page, PageHeader, useShell } from "@/components/shell";
import { Button, DateField, Empty, InlineText, NativeSelect, Pill, Popover, SelectPill, Skeleton } from "@/components/ui";
import { DeleteProjectDialog } from "@/components/delete-project";
import { cn } from "@/lib/cn";
import { CATEGORIES, STATUSES } from "@/lib/constants";
import { today as todayFn } from "@/lib/dates";
import { pct, relDay, tone, usd } from "@/lib/format";
import { useProjects, useUpdateProject, type Project } from "@/lib/client/api";
import { CATEGORY_OPTS, ELIGIBILITY_OPTS, PRIORITY_OPTS, RISK_OPTS, STATUS_OPTS, TIER_OPTS, catTone } from "@/lib/options";
import { Rating } from "@/components/panelui/rating";
import { SORTS, nextDate, pnlFor, sortProjects } from "@/lib/project-utils";
import { claimBadge } from "@/lib/claim";

function ClaimPill({ p, today, className }: { p: Project; today: string; className?: string }) {
  const b = claimBadge(p, today);
  return b && b.id !== "watching" ? <Pill tone={b.tone} dot className={className}>{b.label}</Pill> : null;
}

const VIEWS = [
  { id: "table", label: "Table", icon: Rows3 },
  { id: "board", label: "Board", icon: Columns3 },
  { id: "list", label: "List", icon: LayoutList },
];

export function ProjectsView() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const cat = sp.get("cat") ?? "all";
  const view = sp.get("view") ?? "table";
  const { data, isLoading } = useProjects();
  const { newProject } = useShell();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("updated");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [hideClosed, setHideClosed] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterBtn, setFilterBtn] = useState<HTMLButtonElement | null>(null);
  const [eligFilter, setEligFilter] = useState<string[]>([]);
  const [eligOpen, setEligOpen] = useState(false);
  const [eligBtn, setEligBtn] = useState<HTMLButtonElement | null>(null);
  const today = todayFn();

  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(sp.toString());
    if (v === "all" && k === "cat") p.delete("cat");
    else p.set(k, v);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };

  const positions = useMemo(() => data?.positions ?? [], [data]);
  const pnlCache = useMemo(() => new Map((data?.projects ?? []).map((p) => [p.id, pnlFor(p, positions)])), [data, positions]);
  const pnl = (p: Project) => pnlCache.get(p.id)!;

  const list = useMemo(() => {
    let l = data?.projects ?? [];
    if (cat !== "all") l = l.filter((p) => p.category === cat);
    if (eligFilter.length) l = l.filter((p) => eligFilter.includes(p.eligibility ?? "unknown"));
    if (statusFilter.length) l = l.filter((p) => statusFilter.includes(p.status));
    else if (hideClosed && view !== "board") l = l.filter((p) => p.status !== "done" && p.status !== "dropped");
    if (q.trim()) {
      const s = q.toLowerCase();
      l = l.filter((p) => [p.name, p.summary ?? "", ...p.tags, ...p.chains].join(" ").toLowerCase().includes(s));
    }
    return sortProjects(l, sort, today, (p) => pnlCache.get(p.id)!);
  }, [data, cat, statusFilter, eligFilter, hideClosed, q, sort, today, pnlCache, view]);

  const catLabel = cat === "all" ? "All projects" : CATEGORIES.find((c) => c.id === cat)?.label ?? "Projects";
  const total = (data?.projects ?? []).filter((p) => cat === "all" || p.category === cat).length;

  return (
    <Page wide>
      <PageHeader
        title={catLabel}
        subtitle={isLoading ? " " : `${total} ${total === 1 ? "project" : "projects"} · ${list.length} shown`}
        right={
          <Button variant="primary" onClick={() => newProject(cat === "all" ? undefined : cat)}>
            <Plus className="h-3.5 w-3.5" /> New
          </Button>
        }
      />
      <div className="mb-3 flex gap-5 overflow-x-auto border-b border-line">
        {[{ id: "all", label: "All" }, ...CATEGORIES].map((c) => (
          <button
            key={c.id}
            onClick={() => setParam("cat", c.id)}
            className={cn("relative -mb-px whitespace-nowrap border-b-2 pb-2 pt-1 text-[13.5px] transition-colors", cat === c.id ? "border-ink font-medium text-ink" : "border-transparent text-muted hover:text-ink")}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-line bg-panel p-0.5">
          {VIEWS.map((v) => (
            <button key={v.id} onClick={() => setParam("view", v.id)} className={cn("flex h-7 items-center gap-1.5 rounded-[5px] px-2.5 text-[12.5px]", view === v.id ? "bg-active text-ink" : "text-muted hover:text-ink")}>
              <v.icon className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{v.label}</span>
            </button>
          ))}
        </div>
        <div className="relative min-w-[160px] flex-1 sm:max-w-[280px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name, tag, chain" className="h-8 w-full rounded-md border border-line bg-panel pl-8 pr-2 text-[13px] outline-none placeholder:text-faint focus:ring-2 focus:ring-[var(--ring)]" />
        </div>
        <Button ref={setFilterBtn} size="md" variant={statusFilter.length ? "subtle" : "ghost"} onClick={() => setFilterOpen((o) => !o)}>
          <Filter className="h-3.5 w-3.5" /> Status{statusFilter.length ? ` · ${statusFilter.length}` : ""}
        </Button>
        <Popover anchor={filterBtn} open={filterOpen} onClose={() => setFilterOpen(false)} width={220}>
          {STATUS_OPTS.map((s) => (
            <div key={s.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-hover">
              <Checkbox aria-label={s.label} checked={statusFilter.includes(s.id)} onCheckedChange={(v) => setStatusFilter((f) => (v ? [...f, s.id] : f.filter((x) => x !== s.id)))} />
              <button type="button" onClick={() => setStatusFilter((f) => (f.includes(s.id) ? f.filter((x) => x !== s.id) : [...f, s.id]))}><Pill tone={s.tone} dot>{s.label}</Pill></button>
            </div>
          ))}
          <div className="mt-1 border-t border-line pt-1">
            <div className="rounded-md px-2 py-1.5 text-[13px] text-ink-2 hover:bg-hover">
              <Checkbox checked={hideClosed} onCheckedChange={setHideClosed} label="Hide Done & Dropped" className="gap-2" />
            </div>
          </div>
        </Popover>
        <Button ref={setEligBtn} size="md" variant={eligFilter.length ? "subtle" : "ghost"} onClick={() => setEligOpen((o) => !o)}>
          <BadgeCheck className="h-3.5 w-3.5" /> Eligibility{eligFilter.length ? ` · ${eligFilter.length}` : ""}
        </Button>
        <Popover anchor={eligBtn} open={eligOpen} onClose={() => setEligOpen(false)} width={220}>
          {ELIGIBILITY_OPTS.map((s) => (
            <div key={s.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-hover">
              <Checkbox aria-label={s.label} checked={eligFilter.includes(s.id)} onCheckedChange={(v) => setEligFilter((f) => (v ? [...f, s.id] : f.filter((x) => x !== s.id)))} />
              <button type="button" onClick={() => setEligFilter((f) => (f.includes(s.id) ? f.filter((x) => x !== s.id) : [...f, s.id]))}><Pill tone={s.tone} dot>{s.label}</Pill></button>
            </div>
          ))}
          {eligFilter.length > 0 && (
            <div className="mt-1 border-t border-line pt-1">
              <button type="button" onClick={() => setEligFilter([])} className="w-full rounded-md px-2 py-1.5 text-left text-[13px] text-ink-2 hover:bg-hover">Clear</button>
            </div>
          )}
        </Popover>
        <NativeSelect variant="ghost" icon={<SlidersHorizontal />} label="Sort" value={sort} onChange={setSort} options={SORTS} width={200} />
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : total === 0 ? (
        <Onboarding cat={cat} onNew={() => newProject(cat === "all" ? undefined : cat)} />
      ) : view === "board" ? (
        <Board projects={list} pnl={pnl} today={today} showCat={cat === "all"} />
      ) : view === "list" ? (
        <ListView projects={list} pnl={pnl} today={today} />
      ) : (
        <TableView projects={list} pnl={pnl} today={today} showCat={cat === "all"} onNew={() => newProject(cat === "all" ? undefined : cat)} />
      )}
    </Page>
  );
}

function Onboarding({ cat, onNew }: { cat: string; onNew: () => void }) {
  const label = cat === "all" ? "project" : `${CATEGORIES.find((c) => c.id === cat)?.label} project`;
  return (
    <Empty
      icon={<Rows3 className="h-6 w-6" />}
      title={`Your first ${label} starts here`}
      body={
        <>
          Add a project, set its status and key dates, log gas and capital, then come back daily from <b className="font-medium text-ink-2">Today</b>. Press <span className="kbd">N</span> anywhere to add one.
        </>
      }
      action={
        <Button variant="primary" onClick={onNew}>
          <Plus className="h-3.5 w-3.5" /> New {label}
        </Button>
      }
    />
  );
}

type ViewProps = { projects: Project[]; pnl: (p: Project) => ReturnType<typeof pnlFor>; today: string; showCat?: boolean };

function TableView({ projects, pnl, today, showCat, onNew }: ViewProps & { onNew: () => void }) {
  const update = useUpdateProject();
  const set = (id: string, patch: Partial<Project>) => update.mutate({ id, patch });
  const th = "h-8 whitespace-nowrap px-2 text-left text-[12px] font-medium text-muted";
  const td = "h-10 border-t border-line px-1 align-middle";
  return (
    <>
    <MobileCards projects={projects} pnl={pnl} today={today} showCat={showCat} set={set} onNew={onNew} />
    <div className="hidden overflow-x-auto rounded-lg border border-line bg-panel md:block">
      <table className="w-full min-w-[1080px] border-collapse">
        <thead>
          <tr>
            <th className={cn(th, "w-[260px] pl-3")}>Name</th>
            {showCat && <th className={th}>Category</th>}
            <th className={th}>Status</th>
            <th className={th}>Eligibility</th>
            <th className={th}>Chains</th>
            <th className={th}>Priority</th>
            <th className={th}>Tier</th>
            <th className={th}>Rating</th>
            <th className={th}>Risk</th>
            <th className={th}>Deadline</th>
            <th className={cn(th, "text-right")}>Invested</th>
            <th className={cn(th, "text-right")}>Net PnL</th>
            <th className={cn(th, "pr-3 text-right")}>ROI</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => {
            const r = pnl(p);
            const nd = nextDate(p, today);
            return (
              <tr key={p.id} className="group transition-colors hover:bg-[color-mix(in_oklab,var(--hover)_55%,transparent)]">
                <td className={cn(td, "pl-2")}>
                  <Link href={`/projects/${p.id}`} className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-hover">
                    <ProjectMark p={p} />
                    <span className="truncate font-medium">{p.name}</span>
                    {nd && <span className="ml-auto hidden shrink-0 items-center gap-1 text-[11.5px] text-muted group-hover:flex"><CalendarClock className="h-3 w-3" />{nd.label} {relDay(nd.day, today)}</span>}
                  </Link>
                </td>
                {showCat && <td className={td}><SelectPill value={p.category} options={CATEGORY_OPTS} onChange={(v) => set(p.id, { category: v })} dot={false} /></td>}
                <td className={td}><SelectPill value={p.status} options={STATUS_OPTS} onChange={(v) => set(p.id, { status: v })} /></td>
                <td className={td}><SelectPill value={p.eligibility ?? "unknown"} options={ELIGIBILITY_OPTS} onChange={(v) => set(p.id, { eligibility: v })} /></td>
                <td className={cn(td, "max-w-[180px]")}>
                  <div className="flex gap-1 overflow-hidden px-1">{p.chains.slice(0, 3).map((c) => <Pill key={c}><ChainLabel chain={c} size={14} /></Pill>)}{p.chains.length > 3 && <span className="text-[12px] text-faint">+{p.chains.length - 3}</span>}</div>
                </td>
                <td className={td}><SelectPill value={p.priority} options={PRIORITY_OPTS} onChange={(v) => set(p.id, { priority: v })} dot={false} /></td>
                <td className={td}><SelectPill value={p.tier} options={TIER_OPTS} onChange={(v) => set(p.id, { tier: v })} dot={false} /></td>
                <td className={cn(td, "px-2")}><Rating value={p.rating} onChange={(v) => set(p.id, { rating: v })} size={12} /></td>
                <td className={td}><SelectPill value={p.risk} options={RISK_OPTS} onChange={(v) => set(p.id, { risk: v })} /></td>
                <td className={cn(td, "w-[160px]")}><DateField value={p.deadline} onSave={(v) => set(p.id, { deadline: v })} className="text-[12.5px]" /></td>
                <td className={cn(td, "num pr-2 text-right text-[13px] text-ink-2")}>{r.invested ? usd(r.invested, { compact: true }) : <span className="text-faint">—</span>}</td>
                <td className={cn(td, "num pr-2 text-right text-[13px]", tone(r.net))}>{r.invested || r.realized ? usd(r.net, { sign: true, compact: true }) : <span className="text-faint">—</span>}</td>
                <td className={cn(td, "num pr-3 text-right text-[13px]", tone(r.roi))}>{pct(r.roi)}</td>
              </tr>
            );
          })}
          <tr>
            <td colSpan={13} className="border-t border-line">
              <button onClick={onNew} className="flex h-9 w-full items-center gap-2 px-3 text-[13px] text-muted hover:bg-hover hover:text-ink">
                <Plus className="h-3.5 w-3.5" /> New project
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      {projects.length === 0 && <div className="border-t border-line px-3 py-6 text-center text-[13px] text-muted">No projects match these filters.</div>}
    </div>
    </>
  );
}

/** Phones: no sideways table. Each project is a card; tap the chevron to unfold every field, stacked. */
function MobileCards({ projects, pnl, today, showCat, set, onNew }: ViewProps & { set: (id: string, patch: Partial<Project>) => void; onNew: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);
  return (
    <div className="space-y-2 md:hidden">
      {deleting && <DeleteProjectDialog project={deleting} open onClose={() => setDeleting(null)} onDeleted={() => setOpen(null)} />}
      {projects.map((p) => {
        const r = pnl(p);
        const nd = nextDate(p, today);
        const st = STATUS_OPTS.find((s) => s.id === p.status);
        const isOpen = open === p.id;
        const row = (label: string, node: React.ReactNode) => (
          <div className="flex min-h-9 items-center justify-between gap-3 border-t border-line py-1">
            <span className="shrink-0 text-[12.5px] text-muted">{label}</span>
            <div className="flex min-w-0 justify-end">{node}</div>
          </div>
        );
        return (
          <div key={p.id} className="overflow-hidden rounded-xl border border-line bg-panel">
            <button type="button" onClick={() => setOpen(isOpen ? null : p.id)} aria-expanded={isOpen} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left active:bg-hover">
              <ProjectMark p={p} size={26} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-medium text-ink">{p.name}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted">
                  {nd ? <><CalendarClock className="h-3 w-3 shrink-0" /><span className="truncate">{nd.label} {relDay(nd.day, today)}</span></> : (p.chains.length ? <ChainInline chains={p.chains} /> : <span className="truncate">No dates</span>)}
                  {r.invested > 0 && <span className={cn("num ml-auto shrink-0", tone(r.net))}>{usd(r.net, { sign: true, compact: true })}</span>}
                </div>
              </div>
              {st && <Pill tone={st.tone} dot className="shrink-0">{st.label}</Pill>}
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-faint transition-transform", isOpen && "rotate-180")} />
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }} className="overflow-hidden">
                  <div className="px-3 pb-2">
                    {showCat && row("Category", <SelectPill value={p.category} options={CATEGORY_OPTS} onChange={(v) => set(p.id, { category: v })} dot={false} />)}
                    {row("Status", <SelectPill value={p.status} options={STATUS_OPTS} onChange={(v) => set(p.id, { status: v })} />)}
                    {row("Eligibility", <SelectPill value={p.eligibility ?? "unknown"} options={ELIGIBILITY_OPTS} onChange={(v) => set(p.id, { eligibility: v })} />)}
                    {claimBadge(p, today) && row("Claim", <ClaimPill p={p} today={today} />)}
                    {row("Chains", p.chains.length ? <div className="flex flex-wrap justify-end gap-1">{p.chains.map((c) => <Pill key={c}><ChainLabel chain={c} size={14} /></Pill>)}</div> : <span className="text-[13px] text-faint">None</span>)}
                    {row("Priority", <SelectPill value={p.priority} options={PRIORITY_OPTS} onChange={(v) => set(p.id, { priority: v })} dot={false} />)}
                    {row("Tier", <SelectPill value={p.tier} options={TIER_OPTS} onChange={(v) => set(p.id, { tier: v })} dot={false} />)}
                    {row("Rating", <Rating value={p.rating} onChange={(v) => set(p.id, { rating: v })} size={14} />)}
                    {row("Risk", <SelectPill value={p.risk} options={RISK_OPTS} onChange={(v) => set(p.id, { risk: v })} />)}
                    {row("Deadline", <DateField value={p.deadline} onSave={(v) => set(p.id, { deadline: v })} className="text-right text-[12.5px]" align="end" />)}
                    {row("Invested", <span className="num text-[13px] text-ink-2">{r.invested ? usd(r.invested, { compact: true }) : "—"}</span>)}
                    {row("Net PnL", <span className={cn("num text-[13px]", tone(r.net))}>{r.invested || r.realized ? usd(r.net, { sign: true, compact: true }) : "—"}</span>)}
                    {row("ROI", <span className={cn("num text-[13px]", tone(r.roi))}>{pct(r.roi)}</span>)}
                    <div className="mt-1.5 flex gap-2">
                      <Link href={`/projects/${p.id}`} className="flex h-10 flex-1 items-center justify-center gap-1 rounded-lg bg-hover text-[13px] font-medium text-ink">Open project <ArrowUpRight className="h-3.5 w-3.5" /></Link>
                      <button type="button" onClick={() => setDeleting({ id: p.id, name: p.name })} className="flex h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-neg hover:bg-[var(--t-red-bg)]" aria-label={`Delete ${p.name}`}>
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
      {projects.length === 0 && <div className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-[13px] text-muted">No projects match these filters.</div>}
      <button onClick={onNew} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line text-[13px] text-muted hover:text-ink">
        <Plus className="h-3.5 w-3.5" /> New project
      </button>
    </div>
  );
}

function Board({ projects, pnl, today, showCat }: ViewProps) {
  const update = useUpdateProject();
  const [over, setOver] = useState<string | null>(null);
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-8 sm:px-8">
      <div className="flex min-w-max gap-3">
        {STATUSES.map((s) => {
          const items = projects.filter((p) => p.status === s.id);
          return (
            <div
              key={s.id}
              onDragOver={(e) => { e.preventDefault(); setOver(s.id); }}
              onDragLeave={() => setOver((o) => (o === s.id ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const id = e.dataTransfer.getData("text/project");
                if (id) update.mutate({ id, patch: { status: s.id } });
              }}
              className={cn("w-[264px] shrink-0 rounded-lg p-1.5 transition-colors", over === s.id ? "bg-active" : "bg-sidebar")}
            >
              <div className="mb-1.5 flex items-center gap-2 px-1.5 py-1">
                <Pill tone={s.tone} dot>{s.label}</Pill>
                <span className="num text-[12px] text-faint">{items.length}</span>
              </div>
              <div className="space-y-1.5">
                {items.map((p) => {
                  const r = pnl(p);
                  const nd = nextDate(p, today);
                  return (
                    <Link
                      key={p.id}
                      href={`/projects/${p.id}`}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/project", p.id)}
                      className="block rounded-md border border-line bg-panel p-2.5 shadow-[0_1px_0_rgba(0,0,0,0.02)] transition-[border,transform] hover:border-line-strong active:scale-[0.99]"
                    >
                      <div className="flex items-start gap-2">
                        <ProjectMark p={p} size={18} />
                        <div className="min-w-0 flex-1 text-[13.5px] font-medium leading-snug">{p.name}</div>
                        {p.rating > 0 ? <Rating value={p.rating} readOnly size={10} /> : <span className="num text-[11px] text-faint">{p.tier}</span>}
                      </div>
                      {p.summary && <p className="mt-1 line-clamp-2 text-[12.5px] text-muted">{p.summary}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        {showCat && <Pill tone={catTone(p.category)}>{CATEGORY_OPTS.find((c) => c.id === p.category)?.label}</Pill>}
                        {p.chains.slice(0, 2).map((c) => <Pill key={c}><ChainLabel chain={c} size={14} /></Pill>)}
                        {p.eligibility && p.eligibility !== "unknown" && (() => { const e = ELIGIBILITY_OPTS.find((x) => x.id === p.eligibility); return e ? <Pill tone={e.tone} dot>{e.label}</Pill> : null; })()}
                        <ClaimPill p={p} today={today} />
                      </div>
                      {(nd || r.invested > 0) && (
                        <div className="mt-2 flex items-center justify-between text-[11.5px] text-muted">
                          <span className="flex items-center gap-1">{nd && <><CalendarClock className="h-3 w-3" /> {nd.label} · {relDay(nd.day, today)}</>}</span>
                          {r.invested > 0 && <span className={cn("num", tone(r.net))}>{usd(r.net, { sign: true, compact: true })}</span>}
                        </div>
                      )}
                    </Link>
                  );
                })}
                {items.length === 0 && <div className="rounded-md border border-dashed border-line px-2 py-5 text-center text-[12px] text-faint">Drop here</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ListView({ projects, pnl, today }: ViewProps) {
  if (projects.length === 0) return <div className="py-10 text-center text-[13px] text-muted">No projects match these filters.</div>;
  return (
    <div className="divide-y divide-line rounded-lg border border-line bg-panel">
      {projects.map((p) => {
        const r = pnl(p);
        const nd = nextDate(p, today);
        const st = STATUS_OPTS.find((s) => s.id === p.status)!;
        return (
          <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-hover">
            <ProjectMark p={p} size={28} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[14px] font-medium">{p.name}</span>
                <span className="text-[12px] capitalize text-faint">{p.category}</span>
              </div>
              <div className="flex min-w-0 text-[12.5px] text-muted">{p.summary ? <span className="truncate">{p.summary}</span> : p.chains.length ? <ChainInline chains={p.chains} max={3} /> : <span className="truncate">No summary yet</span>}</div>
            </div>
            <div className="hidden text-right text-[12px] text-muted sm:block">{nd ? <>{nd.label}<div className="num text-ink-2">{relDay(nd.day, today)}</div></> : null}</div>
            <div className={cn("num hidden w-[90px] text-right text-[13px] md:block", tone(r.net))}>{r.invested ? usd(r.net, { sign: true, compact: true }) : ""}</div>
            {p.eligibility && p.eligibility !== "unknown" && (() => { const e = ELIGIBILITY_OPTS.find((x) => x.id === p.eligibility); return e ? <Pill tone={e.tone} dot className="hidden sm:inline-flex">{e.label}</Pill> : null; })()}
            <ClaimPill p={p} today={today} className="hidden sm:inline-flex" />
            <Pill tone={st.tone} dot>{st.label}</Pill>
          </Link>
        );
      })}
    </div>
  );
}
