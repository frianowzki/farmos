import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { decrypt, encrypt } from "./crypto";

const ROW = "default";

export async function saveGoogleTokens(t: { email: string; accessToken: string; refreshToken: string | null; expiresAt: number | null; scope: string | null }) {
  const existing = await db().select().from(schema.googleTokens).where(eq(schema.googleTokens.id, ROW)).limit(1);
  const refresh = t.refreshToken ? encrypt(t.refreshToken) : existing[0]?.refreshToken ?? null;
  const values = { id: ROW, email: t.email, accessToken: encrypt(t.accessToken), refreshToken: refresh, expiresAt: t.expiresAt, scope: t.scope, updatedAt: new Date() };
  await db().insert(schema.googleTokens).values(values).onConflictDoUpdate({ target: schema.googleTokens.id, set: values });
}

export async function googleStatus() {
  const configured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.AUTH_SECRET);
  if (!configured) return { configured, connected: false as const, email: null, scope: null };
  const rows = await db().select().from(schema.googleTokens).where(eq(schema.googleTokens.id, ROW)).limit(1);
  const r = rows[0];
  return { configured, connected: Boolean(r), email: r?.email ?? null, scope: r?.scope ?? null };
}

export async function disconnectGoogle() {
  const rows = await db().select().from(schema.googleTokens).where(eq(schema.googleTokens.id, ROW)).limit(1);
  const token = decrypt(rows[0]?.refreshToken) ?? decrypt(rows[0]?.accessToken);
  if (token) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: "POST" }).catch(() => null);
  await db().delete(schema.googleTokens).where(eq(schema.googleTokens.id, ROW));
}

export class GoogleError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
  }
}

async function accessToken(): Promise<string> {
  const rows = await db().select().from(schema.googleTokens).where(eq(schema.googleTokens.id, ROW)).limit(1);
  const r = rows[0];
  if (!r) throw new GoogleError("Google is not connected", 412);
  const now = Math.floor(Date.now() / 1000);
  const at = decrypt(r.accessToken);
  if (at && r.expiresAt && r.expiresAt - 60 > now) return at;
  const rt = decrypt(r.refreshToken);
  if (!rt) {
    if (at) return at;
    throw new GoogleError("Google session expired. Reconnect Google.", 401);
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: rt,
    }),
  });
  const j = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !j.access_token) throw new GoogleError(`Token refresh failed (${j.error ?? res.status}). Reconnect Google.`, 401);
  await db()
    .update(schema.googleTokens)
    .set({ accessToken: encrypt(j.access_token), expiresAt: now + (j.expires_in ?? 3600), updatedAt: new Date() })
    .where(eq(schema.googleTokens.id, ROW));
  return j.access_token;
}

export async function gapi<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken();
  const res = await fetch(url, { ...init, headers: { ...(init.headers ?? {}), authorization: `Bearer ${token}`, "content-type": "application/json" }, cache: "no-store" });
  if (res.status === 204) return undefined as T;
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new GoogleError((j as { error?: { message?: string } }).error?.message ?? `Google API ${res.status}`, res.status);
  return j as T;
}

export type MailItem = { id: string; threadId: string; from: string; subject: string; snippet: string; date: string; unread: boolean };

export async function listMail(q: string, max = 40): Promise<MailItem[]> {
  const list = await gapi<{ messages?: { id: string; threadId: string }[] }>(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${max}&q=${encodeURIComponent(q)}`,
  );
  const ids = list.messages ?? [];
  const msgs = await Promise.all(
    ids.map((m) =>
      gapi<{ id: string; threadId: string; snippet: string; labelIds?: string[]; internalDate: string; payload: { headers: { name: string; value: string }[] } }>(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
      ).catch(() => null),
    ),
  );
  return msgs.filter(Boolean).map((m) => {
    const h = (n: string) => m!.payload.headers.find((x) => x.name.toLowerCase() === n.toLowerCase())?.value ?? "";
    return {
      id: m!.id,
      threadId: m!.threadId,
      from: h("From"),
      subject: h("Subject") || "(no subject)",
      snippet: decodeEntities(m!.snippet ?? ""),
      date: new Date(Number(m!.internalDate)).toISOString(),
      unread: m!.labelIds?.includes("UNREAD") ?? false,
    };
  });
}

function decodeEntities(s: string) {
  return s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

export type CalEvent = { id: string; summary: string; start: string; end: string; allDay: boolean; htmlLink: string; location?: string };

export async function upcomingEvents(days = 14): Promise<CalEvent[]> {
  const now = new Date();
  const max = new Date(now.getTime() + days * 86_400_000);
  const j = await gapi<{ items?: { id: string; summary?: string; htmlLink: string; location?: string; start: { date?: string; dateTime?: string }; end: { date?: string; dateTime?: string } }[] }>(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=30&timeMin=${now.toISOString()}&timeMax=${max.toISOString()}`,
  );
  return (j.items ?? []).map((e) => ({
    id: e.id,
    summary: e.summary ?? "(untitled)",
    start: e.start.dateTime ?? e.start.date ?? "",
    end: e.end.dateTime ?? e.end.date ?? "",
    allDay: Boolean(e.start.date),
    htmlLink: e.htmlLink,
    location: e.location,
  }));
}

export async function upsertAllDayEvent(eventId: string | null, ev: { summary: string; description: string; day: string }) {
  const end = new Date(ev.day + "T00:00:00Z");
  end.setUTCDate(end.getUTCDate() + 1);
  const body = {
    summary: ev.summary,
    description: ev.description,
    start: { date: ev.day },
    end: { date: end.toISOString().slice(0, 10) },
    transparency: "transparent",
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 24 * 60 }, { method: "popup", minutes: 15 * 60 }] },
    source: { title: "frioOS", url: process.env.APP_URL ?? "https://frioos-iota.vercel.app" },
  };
  if (eventId) {
    try {
      return await gapi<{ id: string }>(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, { method: "PATCH", body: JSON.stringify(body) });
    } catch (e) {
      if (!(e instanceof GoogleError) || (e.status !== 404 && e.status !== 410)) throw e;
    }
  }
  return gapi<{ id: string }>(`https://www.googleapis.com/calendar/v3/calendars/primary/events`, { method: "POST", body: JSON.stringify(body) });
}

export async function deleteEvent(eventId: string) {
  await gapi(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, { method: "DELETE" }).catch(() => null);
}
