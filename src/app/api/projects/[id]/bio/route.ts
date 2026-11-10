import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { bad, requireProfile } from "@/lib/server/guard";
import { projectBio } from "@/lib/server/xbio";

type Ctx = { params: Promise<{ id: string }> };
const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

/** Look up a one-line bio for this project (X bio, else website description). Read-only: the client decides to save. */
export async function GET(_: Request, ctx: Ctx) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const { id } = await ctx.params;
  if (!isUuid(id)) return bad("not found", 404);
  const [p] = await db().select({ links: schema.projects.links }).from(schema.projects).where(and(eq(schema.projects.profileId, pid), eq(schema.projects.id, id))).limit(1);
  if (!p) return bad("not found", 404);
  if (!p.links?.x && !p.links?.site) return bad("Add the project's X or website link first", 422);
  const b = await projectBio(pid, p.links);
  if (!b) return bad("No bio found on X or the website", 404);
  return NextResponse.json(b);
}
