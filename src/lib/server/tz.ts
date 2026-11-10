import "server-only";

/** farmOS is single-user; the day boundary follows the owner's zone (WIB by default). */
export const APP_TZ = process.env.APP_TZ || "Asia/Jakarta";

export function dayIn(date: Date, tz = APP_TZ): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function timeIn(date: Date, tz = APP_TZ): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}
