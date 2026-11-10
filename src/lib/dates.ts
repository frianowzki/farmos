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

/**
 * The signed-in profile's zone, mirrored into a readable cookie at login so the very first
 * render already uses it (Iya: Asia/Jakarta, Nadine: Asia/Manila). Falls back to the device zone.
 */
export function appTimeZone(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const m = document.cookie.match(/(?:^|; )frio_tz=([^;]+)/);
  if (!m) return undefined;
  const tz = decodeURIComponent(m[1]);
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return undefined;
  }
}

/** Calendar day of an instant in the profile's zone. */
export function dayInZone(d: Date, tz = appTimeZone()): string {
  if (!tz) return toDay(d);
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Wall-clock parts of an instant in the profile's zone. */
export function clockInZone(d: Date, tz = appTimeZone()) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "long", month: "long", day: "numeric", year: "numeric", timeZoneName: "short" });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { h: Number(p.hour) % 24, m: Number(p.minute), s: Number(p.second), weekday: p.weekday, month: p.month, day: p.day, year: Number(p.year), tzName: p.timeZoneName ?? "" };
}

/** Intl prints offsets like "GMT+8" for these; show the names people use locally. */
const ZONE_NAMES: Record<string, string> = { "Asia/Jakarta": "WIB", "Asia/Pontianak": "WIB", "Asia/Makassar": "WITA", "Asia/Jayapura": "WIT", "Asia/Manila": "PHT" };
export function zoneLabel(tz = appTimeZone(), fallback = ""): string {
  if (tz && ZONE_NAMES[tz]) return ZONE_NAMES[tz];
  if (fallback) return fallback;
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value ?? "";
}

/** Local time of the daily 00:00 UTC cron (digest, backup) in a zone, e.g. "07:00 WIB" / "08:00 PHT". */
/** The alert cron runs at 00:00 and 12:00 UTC: "07:00 and 19:00 WIB" in the profile's zone. */
export function alertRunsLabel(tz = appTimeZone()): string {
  const f = (h: number) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(Date.UTC(2026, 0, 15, h, 0)));
  return `${f(0)} and ${f(12)} ${zoneLabel(tz)}`;
}

export function dailyRunLabel(tz = appTimeZone()): string {
  const at = new Date(Date.UTC(2026, 0, 15, 0, 0));
  const t = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
  return `${t} ${zoneLabel(tz)}`;
}

export function today(): string {
  return dayInZone(new Date());
}

/** Minutes since midnight in the profile's zone (for key-date countdowns with a time). */
export function nowMinInZone(): number {
  const c = clockInZone(new Date());
  return c.h * 60 + c.m;
}
