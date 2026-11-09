"use client";
import { CalendarClock, Columns3, Filter, LayoutList, Plus, Rows3, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Monogram, Page, PageHeader, useShell } from "@/components/shell";
import { Button, Empty, InlineText, Pill, Popover, SelectPill, Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { CATEGORIES, STATUSES } from "@/lib/constants";
import { today as todayFn } from "@/lib/dates";
import { pct, relDay, tone, usd } from "@/lib/format";
import { useProjects, useUpdateProject, type Project } from "@/lib/client/api";
import { CATEGORY_OPTS, PRIORITY_OPTS, RISK_OPTS, STATUS_OPTS, TIER_OPTS, catTone } from "@/lib/options";
import { SORTS, nextDate, pnlFor, sortProjects } from "@/lib/project-utils";

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
    if (statusFilter.length) l = l.filter((p) => statusFilter.includes(p.status));
    else if (hideClosed && view !== "board") l = l.filter((p) => p.status !== "done" && p.status !== "dropped");
    if (q.trim()) {
      const s = q.toLowerCase();
      l = l.filter((p) => [p.name, p.summary ?? "", ...p.tags, ...p.chains].join(" ").toLowerCase().includes(s));
    }
    return sortProjects(l, sort, today, (p) => pnlCache.get(p.id)!);
  }, [data, cat, statusFilter, hideClosed, q, sort, today, pnlCache, view]);

  const catLabel = cat === "all" ? "All projects" : CATEGORIES.find((c) => c.id === cat)?.label ?? "Projects";
  const total = (data?.projects ?? []).filter((p) => cat === "all" || p.category === cat).length;

  return (
    <Page wide>
      <PageHeader
        eyebrow="Projects"
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
            <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-hover">
              <input type="checkbox" className="accent-[var(--accent)]" checked={statusFilter.includes(s.id)} onChange={(e) => setStatusFilter((f) => (e.target.checked ? [...f, s.id] : f.filter((x) => x !== s.id)))} />
              <Pill tone={s.tone} dot>{s.label}</Pill>
            </label>
          ))}
          <div className="mt-1 border-t border-line pt-1">
            <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-ink-2 hover:bg-hover">
              <input type="checkbox" className="accent-[var(--accent)]" checked={hideClosed} onChange={(e) => setHideClosed(e.target.checked)} /> Hide Done & Dropped
            </label>
          </div>
        </Popover>
        <label className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[12.5px] text-muted hover:bg-hover">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="bg-transparent text-ink-2 outline-none">
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </label>
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
    <div className="overflow-x-auto rounded-lg border border-line bg-panel">
      <table className="w-full min-w-[980px] border-collapse">
        <thead>
          <tr>
            <th className={cn(th, "w-[260px] pl-3")}>Name</th>
            {showCat && <th className={th}>Category</th>}
            <th className={th}>Status</th>
            <th className={th}>Chains</th>
            <th className={th}>Priority</th>
            <th className={th}>Tier</th>
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
                    <Monogram name={p.name} />
                    <span className="truncate font-medium">{p.name}</span>
                    {nd && <span className="ml-auto hidden shrink-0 items-center gap-1 text-[11.5px] text-muted group-hover:flex"><CalendarClock className="h-3 w-3" />{nd.label} {relDay(nd.day, today)}</span>}
                  </Link>
                </td>
                {showCat && <td className={td}><SelectPill value={p.category} options={CATEGORY_OPTS} onChange={(v) => set(p.id, { category: v })} dot={false} /></td>}
                <td className={td}><SelectPill value={p.status} options={STATUS_OPTS} onChange={(v) => set(p.id, { status: v })} /></td>
                <td className={cn(td, "max-w-[180px]")}>
                  <div className="flex gap-1 overflow-hidden px-1">{p.chains.slice(0, 3).map((c) => <Pill key={c}>{c}</Pill>)}{p.chains.length > 3 && <span className="text-[12px] text-faint">+{p.chains.length - 3}</span>}</div>
                </td>
                <td className={td}><SelectPill value={p.priority} options={PRIORITY_OPTS} onChange={(v) => set(p.id, { priority: v })} dot={false} /></td>
                <td className={td}><SelectPill value={p.tier} options={TIER_OPTS} onChange={(v) => set(p.id, { tier: v })} dot={false} /></td>
                <td className={td}><SelectPill value={p.risk} options={RISK_OPTS} onChange={(v) => set(p.id, { risk: v })} /></td>
                <td className={cn(td, "w-[130px]")}><InlineText type="date" value={p.deadline} onSave={(v) => set(p.id, { deadline: v || null })} mono className="text-[12.5px]" /></td>
                <td className={cn(td, "num pr-2 text-right text-[13px] text-ink-2")}>{r.invested ? usd(r.invested, { compact: true }) : <span className="text-faint">—</span>}</td>
                <td className={cn(td, "num pr-2 text-right text-[13px]", tone(r.net))}>{r.invested || r.realized ? usd(r.net, { sign: true, compact: true }) : <span className="text-faint">—</span>}</td>
                <td className={cn(td, "num pr-3 text-right text-[13px]", tone(r.roi))}>{pct(r.roi)}</td>
              </tr>
            );
          })}
          <tr>
            <td colSpan={11} className="border-t border-line">
              <button onClick={onNew} className="flex h-9 w-full items-center gap-2 px-3 text-[13px] text-muted hover:bg-hover hover:text-ink">
                <Plus className="h-3.5 w-3.5" /> New project
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      {projects.length === 0 && <div className="border-t border-line px-3 py-6 text-center text-[13px] text-muted">No projects match these filters.</div>}
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
                        <Monogram name={p.name} size={18} />
                        <div className="min-w-0 flex-1 text-[13.5px] font-medium leading-snug">{p.name}</div>
                        <span className="num text-[11px] text-faint">{p.tier}</span>
                      </div>
                      {p.summary && <p className="mt-1 line-clamp-2 text-[12.5px] text-muted">{p.summary}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        {showCat && <Pill tone={catTone(p.category)}>{CATEGORY_OPTS.find((c) => c.id === p.category)?.label}</Pill>}
                        {p.chains.slice(0, 2).map((c) => <Pill key={c}>{c}</Pill>)}
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
            <Monogram name={p.name} size={28} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[14px] font-medium">{p.name}</span>
                <span className="text-[12px] capitalize text-faint">{p.category}</span>
              </div>
              <div className="truncate text-[12.5px] text-muted">{p.summary || p.chains.join(" · ") || "No summary yet"}</div>
            </div>
            <div className="hidden text-right text-[12px] text-muted sm:block">{nd ? <>{nd.label}<div className="num text-ink-2">{relDay(nd.day, today)}</div></> : null}</div>
            <div className={cn("num hidden w-[90px] text-right text-[13px] md:block", tone(r.net))}>{r.invested ? usd(r.net, { sign: true, compact: true }) : ""}</div>
            <Pill tone={st.tone} dot>{st.label}</Pill>
          </Link>
        );
      })}
    </div>
  );
}
