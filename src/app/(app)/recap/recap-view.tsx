"use client";
import { ProjectMark } from "@/components/project-mark";
import { Check, NotebookPen, Layers } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Page, PageHeader } from "@/components/shell";
import { Skeleton } from "@/components/ui";
import { DateRangePicker, DateRangePickerContent, DateRangePickerTrigger, DateRangePickerCalendar, DateRangePickerPresets, DateRangePickerPreset, type DateRange } from "@/components/motion/date-range-picker";
import { Timeline, type TimelineEvent } from "@/components/motion/timeline";
import { BarChart } from "@/components/panelui/bar-chart";
import { EmptyState } from "@/components/panelui/empty-state";
import { useDiary, useProjects, useTasks } from "@/lib/client/api";
import { addDays, dayInZone, today } from "@/lib/dates";

const fmtDay = (d: string, o: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, o);
const plain = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

export function RecapView() {
  const t = today();
  const [range, setRange] = useState<DateRange>({ from: addDays(t, -6), to: t });
  const tasks = useTasks();
  const diary = useDiary();
  const projects = useProjects();
  const from = range.from;
  const to = range.to ?? range.from;

  const days = useMemo(() => {
    const out: string[] = [];
    for (let d = to; d >= from && out.length < 120; d = addDays(d, -1)) out.push(d);
    return out;
  }, [from, to]);

  const projMap = useMemo(() => new Map((projects.data?.projects ?? []).map((p) => [p.id, mark(p)])), [projects.data]);
  const data = useMemo(() => {
    const taskById = new Map((tasks.data?.tasks ?? []).map((x) => [x.id, x]));
    const projById = new Map((projects.data?.projects ?? []).map((p) => [p.id, p]));
    const per = new Map<string, { done: { id: string; title: string; projectId: string | null }[]; diary: { id: string; title: string; text: string; projects: Mark[] }[]; created: Mark[] }>();
    for (const d of days) per.set(d, { done: [], diary: [], created: [] });
    for (const c of tasks.data?.completions ?? []) {
      const slot = per.get(c.day);
      const task = taskById.get(c.taskId);
      if (slot && task) slot.done.push({ id: task.id, title: task.title, projectId: task.projectId ?? null });
    }
    for (const e of diary.data?.entries ?? []) {
      const slot = per.get(e.day);
      if (slot) slot.diary.push({ id: e.id, title: e.title || "Untitled", text: plain(e.content).slice(0, 160), projects: e.projectIds.map((id) => projById.get(id)).filter((x): x is NonNullable<typeof x> => Boolean(x)).map(mark) });
    }
    for (const p of projects.data?.projects ?? []) {
      const d = dayInZone(new Date(p.createdAt));
      per.get(d)?.created.push(mark(p));
    }
    return per;
  }, [days, tasks.data, diary.data, projects.data]);

  const totals = useMemo(() => {
    let done = 0, notes = 0, created = 0, active = 0;
    for (const v of data.values()) {
      done += v.done.length;
      notes += v.diary.length;
      created += v.created.length;
      if (v.done.length || v.diary.length || v.created.length) active++;
    }
    return { done, notes, created, active };
  }, [data]);

  const chart = useMemo(() => [...days].reverse().map((d) => ({ day: fmtDay(d, { month: "short", day: "numeric" }), done: data.get(d)?.done.length ?? 0, notes: data.get(d)?.diary.length ?? 0 })), [days, data]);
  const events: TimelineEvent[] = useMemo(
    () =>
      [...days].reverse().filter((d) => {
        const v = data.get(d)!;
        return v.done.length || v.diary.length || v.created.length;
      }).map((d) => {
        const v = data.get(d)!;
        return {
          id: d,
          date: `${d}T00:00:00Z`,
          title: v.diary[0]?.title ?? (v.done.length ? `${v.done.length} task${v.done.length > 1 ? "s" : ""} done` : `${v.created.length} new project${v.created.length > 1 ? "s" : ""}`),
          media: (
            <div className="space-y-1 p-3 text-left text-[12px] text-ink-2">
              {v.done.slice(0, 3).map((x, i) => <div key={i} className="flex items-center gap-1.5 truncate"><Check className="h-3 w-3 shrink-0 text-pos" />{x.title}</div>)}
              {v.diary.slice(0, 1).map((x) => <div key={x.id} className="line-clamp-2 text-muted">{x.text}</div>)}
            </div>
          ),
          meta: <span className="num text-[11px] text-muted">{v.done.length} done · {v.diary.length} notes</span>,
        };
      }),
    [days, data],
  );

  const loading = tasks.isLoading || diary.isLoading || projects.isLoading;
  return (
    <Page>
      <PageHeader
        title="Recap"
        subtitle={`${fmtDay(from, { month: "short", day: "numeric" })} – ${fmtDay(to, { month: "short", day: "numeric", year: "numeric" })}`}
        right={
          <DateRangePicker value={range} onValueChange={(r) => r && setRange(r)} max={t} closeOnSelect>
            <DateRangePickerTrigger className="h-8 rounded-md border border-line bg-panel px-3 text-[13px]" />
            <DateRangePickerContent>
              <DateRangePickerPresets>
                <DateRangePickerPreset label="7 days" value={{ from: addDays(t, -6), to: t }} />
                <DateRangePickerPreset label="14 days" value={{ from: addDays(t, -13), to: t }} />
                <DateRangePickerPreset label="30 days" value={{ from: addDays(t, -29), to: t }} />
              </DateRangePickerPresets>
              <DateRangePickerCalendar />
            </DateRangePickerContent>
          </DateRangePicker>
        }
      />
      {loading ? (
        <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-48" /></div>
      ) : (
        <>
          <dl className="mb-6 grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-panel sm:grid-cols-4">
            {[
              ["Tasks done", totals.done],
              ["Diary notes", totals.notes],
              ["New projects", totals.created],
              ["Active days", `${totals.active}/${days.length}`],
            ].map(([k, v], i) => (
              <div key={k as string} className={`px-4 py-3 ${i % 2 ? "border-l border-line" : ""} ${i >= 2 ? "border-t border-line sm:border-t-0" : ""} ${i === 2 ? "sm:border-l" : ""}`}>
                <dt className="font-label text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted">{k}</dt>
                <dd className="num mt-1 text-[22px] text-ink">{v}</dd>
              </div>
            ))}
          </dl>

          {totals.active === 0 ? (
            <EmptyState mark="sun" title="Nothing logged in this range" body="Tick daily tasks, write a diary note, or add a project and it shows up here, day by day." action={<Link href="/tasks" className="text-[13px] text-accent hover:underline">Go to daily tasks</Link>} />
          ) : (
            <>
              <section className="mb-8 rounded-xl border border-line bg-panel p-4">
                <BarChart data={chart} xDataKey="day" aspectRatio={3.6} barWidth={26} stacked label="Tasks done and diary notes per day">
                  <BarChart.Grid />
                  <BarChart.Bar dataKey="done" color="chart-1" />
                  <BarChart.Bar dataKey="notes" color="chart-3" />
                  <BarChart.XAxis />
                  <BarChart.Tooltip labels={{ done: "Tasks done", notes: "Diary notes" }} formatValue={(v) => String(v)} />
                </BarChart>
              </section>
              {events.length > 1 && (
                <section className="mb-8 hidden md:block">
                  <Timeline events={events} defaultValue={events[events.length - 1]?.id} itemWidth={220} height={300} ruler aria-label="Active days" formatDate={(d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })} />
                </section>
              )}
              <ol className="space-y-6">
                {days.map((d) => {
                  const v = data.get(d)!;
                  if (!v.done.length && !v.diary.length && !v.created.length) return null;
                  return (
                    <li key={d} className="grid gap-2 md:grid-cols-[140px_1fr]">
                      <div className="font-serif text-[17px] text-ink">{fmtDay(d)}</div>
                      <div className="space-y-2 border-l border-line pl-4">
                        {v.created.map((p) => (
                          <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center gap-2 text-[13.5px] text-ink hover:underline"><Layers className="h-3.5 w-3.5 text-muted" /> Added <ProjectMark p={p} size={16} /> {p.name}</Link>
                        ))}
                        {v.done.map((x, i) => (
                          <div key={i} className="flex min-w-0 items-center gap-2 text-[13.5px] text-ink-2"><Check className="h-3.5 w-3.5 shrink-0 text-pos" /> <span className="truncate">{x.title}</span>{(() => { const pr = x.projectId ? projMap.get(x.projectId) : undefined; return pr ? <Link href={`/projects/${pr.id}`} className="ml-auto flex shrink-0 items-center gap-1.5 text-[12px] text-faint hover:text-ink-2"><ProjectMark p={pr} size={14} className="rounded-[4px]" /><span className="max-w-[120px] truncate">{pr.name}</span></Link> : null; })()}</div>
                        ))}
                        {v.diary.map((e) => (
                          <Link key={e.id} href={`/diary?entry=${e.id}`} className="block rounded-lg border border-line bg-panel px-3 py-2 hover:border-line-strong">
                            <div className="flex items-center gap-2 text-[13.5px] font-medium text-ink"><NotebookPen className="h-3.5 w-3.5 text-muted" /> {e.title}</div>
                            {e.text && <p className="mt-0.5 line-clamp-2 text-[12.5px] text-muted">{e.text}</p>}
                            {e.projects.length > 0 && <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-faint">{e.projects.map((pr) => <span key={pr.id} className="inline-flex items-center gap-1.5"><ProjectMark p={pr} size={14} className="rounded-[4px]" />{pr.name}</span>)}</div>}
                          </Link>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </>
      )}
    </Page>
  );
}

type Mark = { id: string; name: string; accent: string | null; links: { x?: string } | null };
const mark = (p: { id: string; name: string; accent?: string | null; links?: unknown }): Mark => ({ id: p.id, name: p.name, accent: p.accent ?? null, links: (p.links as { x?: string } | null) ?? null });
