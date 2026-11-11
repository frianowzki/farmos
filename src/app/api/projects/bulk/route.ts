import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { bad, readJson, requireProfile } from "@/lib/server/guard";
import { clean, projectInput } from "@/lib/server/validate";

const bulkInput = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  /** Only the fields a bulk edit makes sense for; free text stays per-project so nothing is clobbered. */
  patch: projectInput.pick({ status: true, category: true, priority: true, pinned: true, tier: true, risk: true, eligibility: true }).partial(),
});

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

/**
 * Bulk edit. Deliberately limited to status/category/archive: those are the fields people change in
 * batches, and they cannot silently overwrite free text across several projects.
 */
export async function PATCH(req: Request) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;

  const parsed = bulkInput.safeParse(await readJson(req));
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "invalid");

  const ids = parsed.data.ids.filter(isUuid);
  if (ids.length === 0) return bad("No valid ids");

  const patch = clean(parsed.data.patch);
  if (Object.keys(patch).length === 0) return bad("Nothing to change");

  const rows = await db()
    .update(schema.projects)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(schema.projects.profileId, pid), inArray(schema.projects.id, ids)))
    .returning({ id: schema.projects.id });

  return NextResponse.json({ updated: rows.length, ids: rows.map((r) => r.id) });
}
