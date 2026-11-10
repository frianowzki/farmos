import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";

const UUID = /^[0-9a-f-]{36}$/i;

/** True when the project exists AND belongs to the profile. Used before linking anything to a project. */
export async function ownsProject(pid: string, id: string | null | undefined): Promise<boolean> {
  if (!id || !UUID.test(id)) return false;
  const [r] = await db().select({ id: schema.projects.id }).from(schema.projects).where(and(eq(schema.projects.profileId, pid), eq(schema.projects.id, id))).limit(1);
  return Boolean(r);
}

/** Keeps only the project ids that belong to the profile. */
export async function ownedProjectIds(pid: string, ids: string[] | null | undefined): Promise<string[]> {
  const list = [...new Set((ids ?? []).filter((x) => UUID.test(x)))];
  if (!list.length) return [];
  const rows = await db().select({ id: schema.projects.id }).from(schema.projects).where(and(eq(schema.projects.profileId, pid), inArray(schema.projects.id, list)));
  const ok = new Set(rows.map((r) => r.id));
  return list.filter((x) => ok.has(x));
}

/** True when the diary entry exists AND belongs to the profile. */
export async function ownsDiary(pid: string, id: string | null | undefined): Promise<boolean> {
  if (!id || !UUID.test(id)) return false;
  const [r] = await db().select({ id: schema.diaryEntries.id }).from(schema.diaryEntries).where(and(eq(schema.diaryEntries.profileId, pid), eq(schema.diaryEntries.id, id))).limit(1);
  return Boolean(r);
}
