import "server-only";
import { and, eq, gte, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { addDays, diffDays } from "@/lib/dates";
import { isDue, isSatisfied, taskStreak } from "@/lib/streak";
import { getSetting, setSetting } from "./settings";
import { dayIn, timeIn } from "./tz";
import { getProfileTz } from "./settings";

export type NotifySettings = {
  chatId?: string | null;
  chatName?: string | null;
  enabled: boolean;
  mints: boolean;
  deadlines: boolean;
  tasks: boolean;
  streaks: boolean;
  /** Instant alerts (sent by the cron checks, not part of the digest). */
  claims: boolean;
  prices: boolean;
  /** one-time /start token for the deep-link flow */
  linkToken?: string | null;
  linkTokenAt?: string | null;
  lastSentAt?: string | null;
  lastResult?: string | null;
};

const DEFAULTS: NotifySettings = { enabled: true, mints: true, deadlines: true, tasks: true, streaks: true, claims: true, prices: true };

export async function getNotify(pid: string): Promise<NotifySettings> {
  return { ...DEFAULTS, ...((await getSetting<NotifySettings>(pid, "notify")) ?? {}) };
}

export async function saveNotify(pid: string, patch: Partial<NotifySettings>) {
  const next = { ...(await getNotify(pid)), ...patch };
  await setSetting(pid, "notify", next);
  return next;
}

/** Public view: never includes the link token. */
export function publicNotify(n: NotifySettings) {
  return {
    linked: Boolean(n.chatId),
    chatName: n.chatName ?? null,
    enabled: n.enabled,
    mints: n.mints,
    deadlines: n.deadlines,
    tasks: n.tasks,
    streaks: n.streaks,
    claims: n.claims,
    prices: n.prices,
    lastSentAt: n.lastSentAt ?? null,
    lastResult: n.lastResult ?? null,
    configured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    botUsername: process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? null,
  };
}

function token() {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  return t;
}

async function tg<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${token()}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const j = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string };
  if (!j.ok) throw new Error(j.description || `Telegram ${method} failed (${res.status})`);
  return j.result as T;
}

export async function sendTelegram(chatId: string, html: string) {
  // Telegram caps messages at 4096 chars.
  const text = html.length > 4000 ? html.slice(0, 3990) + "\n…" : html;
  return tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true });
}

type Update = { update_id: number; message?: { text?: string; chat: { id: number; type: string; username?: string; first_name?: string; title?: string } } };

/** Deep-link flow: find a `/start <token>` message in pending updates and capture its chat id. */
export async function findStartChat(linkToken: string): Promise<{ chatId: string; name: string } | null> {
  const updates = await tg<Update[]>("getUpdates", { timeout: 0, allowed_updates: ["message"] });
  const hit = [...updates].reverse().find((u) => u.message?.text?.trim() === `/start ${linkToken}`);
  if (!hit?.message) return null;
  const c = hit.message.chat;
  // acknowledge processed updates so they are not re-read
  const last = updates[updates.length - 1]?.update_id;
  if (last != null) await tg("getUpdates", { offset: last + 1, timeout: 0 }).catch(() => null);
  return { chatId: String(c.id), name: c.username ? `@${c.username}` : c.first_name || c.title || String(c.id) };
}

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export type Digest = { sections: { title: string; lines: string[] }[]; empty: boolean; day: string; tz: string };

/** Builds the daily digest from live data. Pure read. */
export async function buildDigest(pid: string, n: NotifySettings, now = new Date()): Promise<Digest> {
  const d = db();
  // Day boundary, dates and times follow this profile's zone.
  const tz = await getProfileTz(pid);
  const today = dayIn(now, tz);
  const sections: Digest["sections"] = [];
  const appUrl = process.env.APP_URL || "";

  if (n.mints) {
    const soon = new Date(now.getTime() + 24 * 3600_000);
    const rows = await d.select().from(schema.mintWatch).where(and(eq(schema.mintWatch.profileId, pid), gte(schema.mintWatch.startTime, now), lte(schema.mintWatch.startTime, soon)));
    const lines = rows
      .sort((a, b) => +a.startTime! - +b.startTime!)
      .map((m) => {
        const h = Math.max(0, Math.round((+m.startTime! - +now) / 3600_000));
        const wl = m.manualStatus && m.manualStatus !== "unknown" ? ` · WL: ${esc(m.manualStatus)}` : "";
        return `• <b>${esc(m.name || m.slug)}</b> in ~${h}h (${timeIn(m.startTime!, tz)} ${tzLabel(tz)})${wl}`;
      });
    const projects = await d.select({ name: schema.projects.name, keyDates: schema.projects.keyDates, status: schema.projects.status }).from(schema.projects).where(eq(schema.projects.profileId, pid));
    for (const p of projects) {
      const mint = p.keyDates?.mint;
      if (mint && (mint === today || mint === addDays(today, 1)) && !["done", "dropped"].includes(p.status)) lines.push(`• <b>${esc(p.name)}</b> mint ${mint === today ? "today" : "tomorrow"}`);
    }
    if (lines.length) sections.push({ title: "Mints in the next 24h", lines });
  }

  if (n.deadlines) {
    const projects = await d.select().from(schema.projects).where(eq(schema.projects.profileId, pid));
    const lines: string[] = [];
    for (const p of projects) {
      if (["done", "dropped"].includes(p.status)) continue;
      const dates: [string, string | null | undefined][] = [
        ["Deadline", p.deadline],
        ["Campaign ends", p.campaignEnd],
        ["Snapshot", p.keyDates?.snapshot],
        ["TGE", p.keyDates?.tge],
        ["Claim opens", p.keyDates?.claimStart],
        ["Claim closes", p.keyDates?.claimEnd],
      ];
      for (const [label, day] of dates) {
        if (!day) continue;
        const left = diffDays(day, today);
        if (left < 0 || left > 3) continue;
        lines.push(`• <b>${esc(p.name)}</b>: ${label} ${left === 0 ? "<b>today</b>" : left === 1 ? "tomorrow" : `in ${left} days`} (${day})`);
      }
    }
    if (lines.length) sections.push({ title: "Campaign deadlines (next 3 days)", lines });
  }

  if (n.tasks || n.streaks) {
    const [tasks, comps, projects] = await Promise.all([
      d.select().from(schema.tasks).where(and(eq(schema.tasks.profileId, pid), eq(schema.tasks.active, true))),
      d.select().from(schema.taskCompletions).where(and(eq(schema.taskCompletions.profileId, pid), gte(schema.taskCompletions.day, addDays(today, -400)))),
      d.select({ id: schema.projects.id, name: schema.projects.name }).from(schema.projects).where(eq(schema.projects.profileId, pid)),
    ]);
    const pname = new Map(projects.map((p) => [p.id, p.name]));
    const byTask = new Map<string, string[]>();
    for (const c of comps) byTask.set(c.taskId, [...(byTask.get(c.taskId) ?? []), c.day]);
    const open: string[] = [];
    const risk: string[] = [];
    for (const t of tasks) {
      if (t.remind === false) continue;
      if (!isDue(t, today)) continue;
      const days = byTask.get(t.id) ?? [];
      if (isSatisfied(t, today, new Set(days))) continue;
      const proj = t.projectId ? pname.get(t.projectId) : null;
      open.push(`• ${esc(t.title)}${proj ? ` <i>(${esc(proj)})</i>` : ""}`);
      const s = taskStreak(t, days, today).current;
      if (s >= 2) risk.push(`• ${esc(t.title)}: ${s}-day streak, due today`);
    }
    if (n.tasks && open.length) sections.push({ title: `Today's tasks (${open.length})`, lines: open });
    if (n.streaks && risk.length) sections.push({ title: "Streaks at risk", lines: risk });
  }

  if (appUrl && sections.length) sections.push({ title: "", lines: [`<a href="${esc(appUrl)}">Open farmOS</a>`] });
  return { sections, empty: sections.length === 0, day: today, tz };
}

const ZONE_NAMES: Record<string, string> = { "Asia/Jakarta": "WIB", "Asia/Makassar": "WITA", "Asia/Jayapura": "WIT", "Asia/Manila": "PHT" };
function tzLabel(tz: string) {
  return ZONE_NAMES[tz] ?? tz;
}

export function renderDigest(dg: Digest) {
  const head = `<b>farmOS · ${dg.day}</b>`;
  if (dg.empty) return `${head}\nNothing due today. Clear desk.`;
  return [head, ...dg.sections.map((s) => (s.title ? `\n<b>${esc(s.title)}</b>\n` : "\n") + s.lines.join("\n"))].join("\n");
}

/** Sends the digest if linked + enabled. Returns a short status string. */
export async function sendDigest(pid: string, opts: { force?: boolean; test?: boolean } = {}) {
  const n = await getNotify(pid);
  if (!process.env.TELEGRAM_BOT_TOKEN) return "telegram not configured";
  if (!n.chatId) return "no chat linked";
  if (!n.enabled && !opts.force) return "disabled";
  const dg = await buildDigest(pid, n);
  const text = (opts.test ? "<i>Test from farmOS settings</i>\n\n" : "") + renderDigest(dg);
  try {
    await sendTelegram(n.chatId, text);
    await saveNotify(pid, { lastSentAt: new Date().toISOString(), lastResult: "ok" });
    return "sent";
  } catch (e) {
    const msg = (e as Error).message.slice(0, 200);
    await saveNotify(pid, { lastResult: msg });
    throw e;
  }
}
