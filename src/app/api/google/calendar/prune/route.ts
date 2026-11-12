import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { KEY_DATES } from "@/lib/constants";
import { requireProfile } from "@/lib/server/guard";
import { deleteEvent } from "@/lib/server/google";

export const dynamic = "force-dynamic";

/**
 * Prunes calendar events whose date has passed. Google never expires an all-day event, so without
 * this the user's calendar silently accumulates dead deadlines for projects they finished months
 * ago. Only events farmOS itself created (tracked in calendarLinks) are ever touched.
 */
export async function POST() {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;

  const today = new Date().toISOString().slice(0, 10);
  const links = await db().select().from(schema.calendarLinks).where(eq(schema.calendarLinks.profileId, pid));
  const stale = links.filter((l) => l.day < today);
  if (stale.length === 0) return NextResponse.json({ removed: 0, checked: links.length });

  // Drop events for projects that no longer exist, plus any orphaned by a deleted project row.
  const projectIds = [...new Set(stale.map((l) => l.projectId))];
  const live = projectIds.length
    ? await db().select({ id: schema.projects.id, status: schema.projects.status }).from(schema.projects).where(and(eq(schema.projects.profileId, pid), inArray(schema.projects.id, projectIds)))
    : [];
  const liveIds = new Set(live.map((p) => p.id));

  let removed = 0;
  const failed: string[] = [];
  for (const l of stale) {
    try {
      await deleteEvent(pid, l.eventId);
      await db().delete(schema.calendarLinks).where(and(eq(schema.calendarLinks.profileId, pid), eq(schema.calendarLinks.eventId, l.eventId)));
      removed++;
    } catch (e) {
      // A 404/410 means it is already gone in Google — forget the link rather than retrying forever.
      const msg = (e as Error).message;
      if (/40[49]|not found|gone/i.test(msg)) {
        await db().delete(schema.calendarLinks).where(and(eq(schema.calendarLinks.profileId, pid), eq(schema.calendarLinks.eventId, l.eventId)));
        removed++;
      } else failed.push(msg);
    }
  }
  return NextResponse.json({ removed, checked: links.length, orphans: projectIds.filter((id) => !liveIds.has(id)).length, failed });
}

export async function GET() {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const links = await db().select().from(schema.calendarLinks).where(eq(schema.calendarLinks.profileId, pid));
  const today = new Date().toISOString().slice(0, 10);
  return NextResponse.json({
    total: links.length,
    expired: links.filter((l) => l.day < today).length,
    upcoming: links.filter((l) => l.day >= today).length,
    keyDateKinds: KEY_DATES.length,
  });
}
