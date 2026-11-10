"use client";
import { useQueryClient } from "@tanstack/react-query";
import { Flame, Pause, Play, Trophy } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { Page, PageHeader } from "@/components/shell";
import { AddTask, Heatmap, TaskRow, useTaskModel, weekRate } from "@/components/tasks";
import { SectionTitle, Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { api, keys, useProjects } from "@/lib/client/api";

export function TasksView() {
  const sp = useSearchParams();
  const model = useTaskModel();
  const { data } = useProjects();
  const qc = useQueryClient();
  const active = model.rows.filter((r) => r.task.active);
  const paused = model.rows.filter((r) => !r.task.active);
  const best = Math.max(0, ...model.rows.map((r) => r.streak.best));
  const groups = useMemo(() => {
    const m = new Map<string, typeof active>();
    for (const r of active) {
      const k = r.task.projectId ?? "";
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return [...m.entries()].sort((a, b) => (a[0] === "" ? 1 : b[0] === "" ? -1 : 0));
  }, [active]);
  const name = (id: string) => data?.projects.find((p) => p.id === id)?.name ?? "Project";
  const del = async (id: string) => {
    await api(`/api/tasks/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: keys.tasks });
  };
  const setActive = async (id: string, a: boolean) => {
    await api(`/api/tasks/${id}`, { method: "PATCH", body: { active: a } });
    qc.invalidateQueries({ queryKey: keys.tasks });
  };

  return (
    <Page>
      <PageHeader title="Daily tasks" subtitle="Recurring work across projects. Tick it, keep the streak." />
      <div className="mb-8 grid gap-3 sm:grid-cols-[1fr_1fr_1fr]">
        <Stat label="Current streak" value={model.streak} unit="days" icon={<Flame className={cn("h-4 w-4", model.streak ? "text-accent" : "text-faint")} />} />
        <Stat label="Best task streak" value={best} unit="in a row" icon={<Trophy className="h-4 w-4 text-faint" />} />
        <Stat label="Active days (7d)" value={weekRate(model.allDays, model.today)} unit="of 7" />
      </div>
      <div className="mb-8 rounded-xl border border-line bg-panel p-4">
        <SectionTitle>Last 18 weeks</SectionTitle>
        <Heatmap heat={model.heat} today={model.today} />
      </div>
      <div className="mb-6"><AddTask autoFocus={sp.get("new") === "1"} /></div>
      {model.isLoading ? (
        <Skeleton className="h-40" />
      ) : active.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-[13.5px] text-muted">No recurring tasks yet. Add one above. Daily, weekly on chosen days, or every N days.</div>
      ) : (
        <div className="space-y-6">
          {groups.map(([pid, rows]) => (
            <section key={pid || "none"}>
              <SectionTitle>{pid ? name(pid) : "General"}</SectionTitle>
              <div className="rounded-lg border border-line bg-panel p-1">
                {rows.map((r) => (
                  <div key={r.task.id} className="group/row relative">
                    <TaskRow row={r} showProject={false} onDelete={() => del(r.task.id)} />
                    <button onClick={() => setActive(r.task.id, false)} title="Pause" className="absolute right-9 top-1/2 hidden -translate-y-1/2 rounded p-1 text-faint hover:text-ink group-hover/row:block" aria-label="Pause task">
                      <Pause className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {paused.length > 0 && (
        <section className="mt-8">
          <SectionTitle>Paused</SectionTitle>
          <div className="divide-y divide-line rounded-lg border border-line bg-panel">
            {paused.map((r) => (
              <div key={r.task.id} className="flex items-center gap-3 px-3 py-2 text-[13.5px] text-muted">
                <span className="flex-1 truncate">{r.task.title}</span>
                <button onClick={() => setActive(r.task.id, true)} className="flex items-center gap-1 rounded px-2 py-1 text-[12px] hover:bg-hover hover:text-ink"><Play className="h-3 w-3" /> Resume</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </Page>
  );
}

function Stat({ label, value, unit, icon }: { label: string; value: number; unit: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <div className="flex items-center justify-between text-[12px] font-medium text-muted">{label}{icon}</div>
      <div className="mt-1 flex items-baseline gap-1.5"><span className="num text-[28px] leading-none">{value}</span><span className="text-[12.5px] text-muted">{unit}</span></div>
    </div>
  );
}
