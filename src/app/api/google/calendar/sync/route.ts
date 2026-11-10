import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { KEY_DATES } from "@/lib/constants";
import { bad, readJson, requireProfile } from "@/lib/server/guard";
import { GoogleError, deleteEvent, upsertAllDayEvent } from "@/lib/server/google";
import { getProfileTz } from "@/lib/server/settings";

/** Push a project's deadline + key dates to Google Calendar (idempotent: updates existing events). */
export async function POST(req: Request) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const { projectId } = await readJson<{ projectId?: string }>(req);
  if (!projectId) return bad("projectId required");
  const [p] = await db().select().from(schema.projects).where(and(eq(schema.projects.profileId, pid), eq(schema.projects.id, projectId))).limit(1);
  if (!p) return bad("not found", 404);
  const links = await db().select().from(schema.calendarLinks).where(and(eq(schema.calendarLinks.profileId, pid), eq(schema.calendarLinks.projectId, projectId)));
  const wanted: { kind: string; label: string; day: string; time?: string | null }[] = [];
  if (p.deadline) wanted.push({ kind: "deadline", label: "Deadline", day: p.deadline });
  for (const k of KEY_DATES) {
    const d = p.keyDates?.[k.id as keyof typeof p.keyDates];
    if (typeof d === "string" && d) wanted.push({ kind: k.id, label: k.label, day: d, time: p.keyDates?.times?.[k.id as keyof NonNullable<typeof p.keyDates.times>] ?? null });
  }
  const base = process.env.APP_URL ?? new URL(req.url).origin;
  const tz = await getProfileTz(pid);
  try {
    let created = 0;
    let removed = 0;
    for (const w of wanted) {
      const existing = links.find((l) => l.kind === w.kind);
      const ev = await upsertAllDayEvent(pid, existing?.eventId ?? null, {
        summary: `${p.name} · ${w.label}`,
        description: `${p.category.toUpperCase()} · ${p.status}\n${p.summary ?? ""}\n\nOpen in farmOS: ${base}/projects/${p.id}`,
        day: w.day,
        time: w.time ?? null,
        tz,
      });
      await db()
        .insert(schema.calendarLinks)
        .values({ projectId, kind: w.kind, eventId: ev.id, day: w.day, profileId: pid })
        .onConflictDoUpdate({ target: [schema.calendarLinks.projectId, schema.calendarLinks.kind], set: { eventId: ev.id, day: w.day, updatedAt: new Date() } });
      created++;
    }
    for (const l of links) {
      if (wanted.some((w) => w.kind === l.kind)) continue;
      await deleteEvent(pid, l.eventId);
      await db().delete(schema.calendarLinks).where(and(eq(schema.calendarLinks.profileId, pid), eq(schema.calendarLinks.eventId, l.eventId)));
      removed++;
    }
    return NextResponse.json({ synced: created, removed });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: e instanceof GoogleError ? e.status : 500 });
  }
}
