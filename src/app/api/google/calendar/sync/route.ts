import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { KEY_DATES } from "@/lib/constants";
import { bad, readJson, requireSession } from "@/lib/server/guard";
import { GoogleError, deleteEvent, upsertAllDayEvent } from "@/lib/server/google";

/** Push a project's deadline + key dates to Google Calendar (idempotent: updates existing events). */
export async function POST(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  const { projectId } = await readJson<{ projectId?: string }>(req);
  if (!projectId) return bad("projectId required");
  const [p] = await db().select().from(schema.projects).where(eq(schema.projects.id, projectId)).limit(1);
  if (!p) return bad("not found", 404);
  const links = await db().select().from(schema.calendarLinks).where(eq(schema.calendarLinks.projectId, projectId));
  const wanted: { kind: string; label: string; day: string }[] = [];
  if (p.deadline) wanted.push({ kind: "deadline", label: "Deadline", day: p.deadline });
  for (const k of KEY_DATES) {
    const d = p.keyDates?.[k.id as keyof typeof p.keyDates];
    if (d) wanted.push({ kind: k.id, label: k.label, day: d });
  }
  const base = process.env.APP_URL ?? new URL(req.url).origin;
  try {
    let created = 0;
    let removed = 0;
    for (const w of wanted) {
      const existing = links.find((l) => l.kind === w.kind);
      const ev = await upsertAllDayEvent(existing?.eventId ?? null, {
        summary: `${p.name} · ${w.label}`,
        description: `${p.category.toUpperCase()} · ${p.status}\n${p.summary ?? ""}\n\nOpen in frioOS: ${base}/projects/${p.id}`,
        day: w.day,
      });
      await db()
        .insert(schema.calendarLinks)
        .values({ projectId, kind: w.kind, eventId: ev.id, day: w.day })
        .onConflictDoUpdate({ target: [schema.calendarLinks.projectId, schema.calendarLinks.kind], set: { eventId: ev.id, day: w.day, updatedAt: new Date() } });
      created++;
    }
    for (const l of links) {
      if (wanted.some((w) => w.kind === l.kind)) continue;
      await deleteEvent(l.eventId);
      await db().delete(schema.calendarLinks).where(eq(schema.calendarLinks.eventId, l.eventId));
      removed++;
    }
    return NextResponse.json({ synced: created, removed });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: e instanceof GoogleError ? e.status : 500 });
  }
}
