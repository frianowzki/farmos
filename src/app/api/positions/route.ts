import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { bad, readJson, requireProfile } from "@/lib/server/guard";
import { clean, positionInput } from "@/lib/server/validate";
import { ownsProject } from "@/lib/server/owned";

export async function POST(req: Request) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const parsed = positionInput.safeParse(await readJson(req));
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "invalid");
  const v = clean(parsed.data);
  if (!v.projectId || !v.token) return bad("projectId and token are required");
  if (!(await ownsProject(pid, v.projectId))) return bad("not found", 404);
  const [row] = await db().insert(schema.positions).values({ ...v, projectId: v.projectId, token: v.token, profileId: pid }).returning();
  return NextResponse.json({ position: row }, { status: 201 });
}
