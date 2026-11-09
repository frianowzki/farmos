import { addDays, diffDays, weekStart, weekday } from "./dates";

export type TaskLike = {
  cadence: string; // daily | weekly | custom
  intervalDays: number;
  weekdays: number[]; // 0=Sun..6=Sat, used by weekly when set
  startDate: string;
  active?: boolean;
};

/** Is the task scheduled on `day`? */
export function isDue(task: TaskLike, day: string): boolean {
  if (task.active === false) return false;
  if (diffDays(day, task.startDate) < 0) return false;
  if (task.cadence === "daily") return true;
  if (task.cadence === "weekly") {
    if (task.weekdays.length === 0) return true; // any day this week
    return task.weekdays.includes(weekday(day));
  }
  const every = Math.max(1, task.intervalDays || 1);
  return diffDays(day, task.startDate) % every === 0;
}

/** For weekly tasks without fixed weekdays, done once per week counts. */
export function isSatisfied(task: TaskLike, day: string, done: Set<string>): boolean {
  if (task.cadence === "weekly" && task.weekdays.length === 0) {
    const ws = weekStart(day);
    for (let i = 0; i < 7; i++) if (done.has(addDays(ws, i))) return true;
    return false;
  }
  if (task.cadence === "custom") {
    // a custom task due on `day` can be completed any time until the next due day
    const every = Math.max(1, task.intervalDays || 1);
    for (let i = 0; i < every; i++) if (done.has(addDays(day, i))) return true;
    return false;
  }
  return done.has(day);
}

/**
 * Current streak in "occurrences": consecutive scheduled occurrences completed,
 * counting back from today. An open occurrence today does not break the streak.
 */
export function taskStreak(task: TaskLike, completedDays: string[], todayDay: string): { current: number; best: number } {
  const done = new Set(completedDays);
  const occurrences: string[] = [];
  if (task.cadence === "weekly" && task.weekdays.length === 0) {
    let ws = weekStart(todayDay);
    const startWs = weekStart(task.startDate);
    while (diffDays(ws, startWs) >= 0) {
      occurrences.push(ws);
      ws = addDays(ws, -7);
    }
  } else {
    let d = todayDay;
    let guard = 0;
    while (diffDays(d, task.startDate) >= 0 && guard < 2000) {
      if (isDue(task, d)) occurrences.push(d);
      d = addDays(d, -1);
      guard++;
    }
  }
  const sat = occurrences.map((d) => isSatisfied(task, d, done));
  let current = 0;
  for (let i = 0; i < sat.length; i++) {
    if (sat[i]) current++;
    else if (i === 0) continue; // today's occurrence still open
    else break;
  }
  let best = 0;
  let run = 0;
  for (let i = sat.length - 1; i >= 0; i--) {
    run = sat[i] ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return { current, best: Math.max(best, current) };
}

/** Day streak across the workspace: consecutive days with at least one completion. */
export function dayStreak(allCompletedDays: string[], todayDay: string): number {
  const done = new Set(allCompletedDays);
  let d = done.has(todayDay) ? todayDay : addDays(todayDay, -1);
  let s = 0;
  while (done.has(d)) {
    s++;
    d = addDays(d, -1);
  }
  return s;
}

/** Completion counts per day for the last `weeks` weeks (heatmap). */
export function heatmap(allCompletedDays: string[], todayDay: string, weeks = 18) {
  const counts = new Map<string, number>();
  for (const d of allCompletedDays) counts.set(d, (counts.get(d) ?? 0) + 1);
  const end = addDays(weekStart(todayDay), 6);
  const start = addDays(weekStart(todayDay), -7 * (weeks - 1));
  const cols: { day: string; count: number; future: boolean }[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let i = 0; i < 7; i++) {
      const day = addDays(start, w * 7 + i);
      col.push({ day, count: counts.get(day) ?? 0, future: diffDays(day, todayDay) > 0 });
    }
    cols.push(col);
  }
  return { cols, start, end };
}
