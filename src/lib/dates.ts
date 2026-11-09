/** Local calendar day helpers. Days are "YYYY-MM-DD" strings in the user's local zone. */
export function toDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDay(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(day: string, delta: number): string {
  const d = parseDay(day);
  d.setDate(d.getDate() + delta);
  return toDay(d);
}

export function diffDays(a: string, b: string): number {
  const ms = parseDay(a).getTime() - parseDay(b).getTime();
  return Math.round(ms / 86_400_000);
}

export function weekday(day: string): number {
  return parseDay(day).getDay();
}

/** Monday-based ISO week start. */
export function weekStart(day: string): string {
  const wd = (weekday(day) + 6) % 7;
  return addDays(day, -wd);
}

export function today(): string {
  return toDay(new Date());
}
