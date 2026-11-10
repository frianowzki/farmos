"use client";
import { Checkbox } from "@/components/motion/checkbox";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, ExternalLink, Flame, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { playUi } from "@/lib/client/sound";
import { toast } from "@/lib/client/toast";
import { Button, Input, NativeSelect } from "@/components/ui";
import { ProjectMark } from "@/components/project-mark";
import { cn } from "@/lib/cn";
import { addDays, today as todayFn } from "@/lib/dates";
import { api, keys, useProjects, useTasks, type Task } from "@/lib/client/api";
import { dayStreak, heatmap, isDue, isSatisfied, taskStreak } from "@/lib/streak";

export const CADENCES = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "custom", label: "Every N days" },
];
const WD = ["S", "M", "T", "W", "T", "F", "S"];

export function useTaskModel(projectId?: string) {
  const { data, isLoading } = useTasks();
  const today = todayFn();
  return useMemo(() => {
    const tasks = (data?.tasks ?? []).filter((t) => (projectId ? t.projectId === projectId : true));
    const byTask = new Map<string, string[]>();
    for (const c of data?.completions ?? []) {
      const arr = byTask.get(c.taskId) ?? [];
      arr.push(c.day);
      byTask.set(c.taskId, arr);
    }
    const rows = tasks.map((t) => {
      const days = byTask.get(t.id) ?? [];
      const done = new Set(days);
      const like = { ...t, weekdays: t.weekdays ?? [] };
      return {
        task: t,
        days,
        dueToday: isDue(like, today),
        doneToday: done.has(today),
        satisfied: isSatisfied(like, today, done),
        streak: taskStreak(like, days, today),
      };
    });
    const allDays = (data?.completions ?? []).filter((c) => tasks.some((t) => t.id === c.taskId)).map((c) => c.day);
    return { rows, today, isLoading, streak: dayStreak(allDays, today), heat: heatmap(allDays, today, 18), allDays };
  }, [data, projectId, today, isLoading]);
}

export function useToggleTask() {
  const qc = useQueryClient();
  return async (taskId: string, day: string, done: boolean) => {
    const prev = qc.getQueryData<{ tasks: Task[]; completions: { taskId: string; day: string }[] }>(keys.tasks);
    if (prev && done) {
      // chime when this tick clears everything due today
      const doneToday = new Set(prev.completions.filter((c) => c.day === day).map((c) => c.taskId));
      doneToday.add(taskId);
      const dueOpen = prev.tasks.filter((t) => t.active && isDue({ ...t, weekdays: t.weekdays ?? [] }, day) && !doneToday.has(t.id));
      playUi(dueOpen.length === 0 ? "allDone" : "check");
    } else if (!done) playUi("uncheck");
    if (prev) {
      const completions = done ? [...prev.completions, { taskId, day }] : prev.completions.filter((c) => !(c.taskId === taskId && c.day === day));
      qc.setQueryData(keys.tasks, { ...prev, completions });
    }
    try {
      await api(`/api/tasks/${taskId}/toggle`, { method: "POST", body: { day, done } });
    } catch (e) {
      if (prev) qc.setQueryData(keys.tasks, prev);
      toast.error((e as Error).message);
    }
  };
}

export function TaskRow({ row, showProject = true, onDelete }: { row: ReturnType<typeof useTaskModel>["rows"][number]; showProject?: boolean; onDelete?: () => void }) {
  const toggle = useToggleTask();
  const { data } = useProjects();
  const project = data?.projects.find((p) => p.id === row.task.projectId);
  const today = todayFn();
  const done = row.doneToday;
  return (
    <div className="group flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-hover">
      <Checkbox
        checked={done}
        onCheckedChange={(v) => toggle(row.task.id, today, v)}
        aria-label={done ? `Mark "${row.task.title}" not done` : `Mark "${row.task.title}" done`}
      />
      <div className="min-w-0 flex-1">
        <div className={cn("truncate text-[14px] transition-colors", done && "text-muted line-through decoration-faint")}>{row.task.title}</div>
        <div className="flex items-center gap-2 text-[12px] text-faint">
          {showProject && project && (
            <Link href={`/projects/${project.id}`} className="flex min-w-0 items-center gap-1.5 text-ink-2 hover:text-ink"><ProjectMark p={project} size={14} className="rounded-[4px]" /><span className="truncate">{project.name}</span></Link>
          )}
          <span>{row.task.cadence === "daily" ? "Daily" : row.task.cadence === "weekly" ? (row.task.weekdays.length ? row.task.weekdays.map((d) => WD[d]).join("") : "Weekly") : `Every ${row.task.intervalDays}d`}</span>
          {!row.dueToday && row.satisfied && !done && <span>· done this period</span>}
        </div>
      </div>
      {row.task.url && (
        <a href={row.task.url} target="_blank" rel="noreferrer" className="rounded p-1 text-faint opacity-0 hover:text-ink group-hover:opacity-100" aria-label="Open link">
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
      <span title={`Best ${row.streak.best}`} className={cn("num flex items-center gap-0.5 text-[12px]", row.streak.current > 0 ? "text-accent" : "text-faint")}>
        <Flame className="h-3 w-3" />
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={row.streak.current} initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -6, opacity: 0 }} transition={{ duration: 0.2 }}>
            {row.streak.current}
          </motion.span>
        </AnimatePresence>
      </span>
      {onDelete && <RemindToggle task={row.task} />}
      {onDelete && (
        <button onClick={onDelete} className="rounded p-1 text-faint hover:text-neg [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100" aria-label="Delete task">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/** Per-task switch: include this task in the Telegram digest while it's still open. */
function RemindToggle({ task }: { task: Task }) {
  const qc = useQueryClient();
  const on = task.remind !== false;
  const flip = async () => {
    const prev = qc.getQueryData<{ tasks: Task[]; completions: { taskId: string; day: string }[] }>(keys.tasks);
    if (prev) qc.setQueryData(keys.tasks, { ...prev, tasks: prev.tasks.map((t) => (t.id === task.id ? { ...t, remind: !on } : t)) });
    try {
      await api(`/api/tasks/${task.id}`, { method: "PATCH", body: { remind: !on } });
      toast.success(!on ? "In the Telegram digest" : "Left out of the digest");
    } catch (e) {
      if (prev) qc.setQueryData(keys.tasks, prev);
      toast.error((e as Error).message);
    }
    qc.invalidateQueries({ queryKey: keys.tasks });
  };
  return (
    <button onClick={flip} className={cn("rounded p-1 hover:text-ink", on ? "text-faint [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100" : "text-faint/60")} aria-label={on ? "Remove from Telegram digest" : "Remind in Telegram digest"} aria-pressed={on} title={on ? "Reminded in the Telegram digest" : "Not in the digest"}>
      {on ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
    </button>
  );
}

export function AddTask({ projectId, compact, autoFocus }: { projectId?: string | null; compact?: boolean; autoFocus?: boolean }) {
  const qc = useQueryClient();
  const { data } = useProjects();
  const [title, setTitle] = useState("");
  const [cadence, setCadence] = useState("daily");
  const [interval, setIntervalDays] = useState(2);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [url, setUrl] = useState("");
  const [proj, setProj] = useState<string>(projectId ?? "");
  const submit = async () => {
    if (!title.trim()) return;
    try {
      await api("/api/tasks", {
        method: "POST",
        body: { title: title.trim(), cadence, intervalDays: cadence === "custom" ? interval : 1, weekdays: cadence === "weekly" ? weekdays : [], startDate: todayFn(), projectId: (projectId ?? proj) || null, url: url.trim() || null },
      });
      setTitle("");
      setUrl("");
      qc.invalidateQueries({ queryKey: keys.tasks });
      if (projectId) qc.invalidateQueries({ queryKey: keys.project(projectId) });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="rounded-lg border border-line bg-panel p-2">
      <div className="flex items-center gap-2">
        <Plus className="ml-1 h-4 w-4 text-faint" />
        <input autoFocus={autoFocus} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a recurring task, e.g. Claim faucet, daily check-in" className="h-8 flex-1 bg-transparent text-[14px] outline-none placeholder:text-faint" />
        <Button type="submit" size="sm" variant="primary" disabled={!title.trim()}>Add</Button>
      </div>
      {(title || !compact) && (
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line pt-2">
          <NativeSelect value={cadence} onChange={setCadence} options={CADENCES} className="w-[140px]" />
          {cadence === "custom" && (
            <label className="flex items-center gap-1.5 text-[12.5px] text-muted">
              every <Input type="number" min={1} max={365} value={interval} onChange={(e) => setIntervalDays(Number(e.target.value) || 1)} className="w-16" /> days
            </label>
          )}
          {cadence === "weekly" && (
            <div className="flex gap-0.5">
              {WD.map((d, i) => (
                <button type="button" key={i} onClick={() => setWeekdays((w) => (w.includes(i) ? w.filter((x) => x !== i) : [...w, i]))} className={cn("h-7 w-7 rounded-md text-[12px]", weekdays.includes(i) ? "bg-accent text-accent-ink" : "bg-hover text-muted")}>
                  {d}
                </button>
              ))}
            </div>
          )}
          {!projectId && (
            <NativeSelect value={proj} onChange={setProj} options={[{ id: "", label: "No project", media: <span className="h-4 w-4 shrink-0 rounded-[4px] border border-dashed border-line" /> }, ...(data?.projects ?? []).filter((p) => p.status !== "done" && p.status !== "dropped").map((p) => ({ id: p.id, label: p.name, media: <ProjectMark p={p} size={16} className="rounded-[4px]" /> }))]} className="w-[200px]" width={240} />
          )}
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Link (optional)" className="min-w-[160px] flex-1" />
        </div>
      )}
    </form>
  );
}

export function Heatmap({ heat, today }: { heat: ReturnType<typeof heatmap>; today: string }) {
  const level = (n: number) => (n <= 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 6 ? 3 : 4);
  const months: { col: number; label: string }[] = [];
  heat.cols.forEach((col, i) => {
    const d = new Date(col[0].day + "T00:00:00");
    if (i === 0 || d.getDate() <= 7) {
      const label = d.toLocaleDateString("en-US", { month: "short" });
      if (!months.length || months[months.length - 1].label !== label) months.push({ col: i, label });
    }
  });
  return (
    <div className="overflow-x-auto">
      <div className="relative mb-1 h-4" style={{ width: heat.cols.length * 14 }}>
        {months.map((m) => (
          <span key={m.col} className="absolute text-[10.5px] text-faint" style={{ left: m.col * 14 }}>{m.label}</span>
        ))}
      </div>
      <div className="flex gap-[3px]">
        {heat.cols.map((col, i) => (
          <div key={i} className="flex flex-col gap-[3px]">
            {col.map((c) => (
              <div
                key={c.day}
                title={`${c.day}: ${c.count} done`}
                className={cn("h-[11px] w-[11px] rounded-[3px]", c.future && "opacity-30", c.day === today && "ring-1 ring-ink/40")}
                style={{ background: `var(--heat-${level(c.count)})` }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1 text-[10.5px] text-faint">
        Less {[0, 1, 2, 3, 4].map((l) => <span key={l} className="h-[9px] w-[9px] rounded-[2px]" style={{ background: `var(--heat-${l})` }} />)} More
      </div>
    </div>
  );
}

export function weekRate(allDays: string[], today: string) {
  const set = new Set(allDays);
  let active = 0;
  for (let i = 0; i < 7; i++) if (set.has(addDays(today, -i))) active++;
  return active;
}
