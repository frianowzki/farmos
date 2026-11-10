import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { bad, readJson, requireProfile } from "@/lib/server/guard";
import { clean, projectInput } from "@/lib/server/validate";

export async function GET() {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const [projects, positions] = await Promise.all([
    db().select().from(schema.projects).where(eq(schema.projects.profileId, pid)).orderBy(desc(schema.projects.updatedAt)),
    db().select().from(schema.positions).where(eq(schema.positions.profileId, pid)),
  ]);
  return NextResponse.json({ projects, positions });
}

export async function POST(req: Request) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const parsed = projectInput.safeParse(await readJson(req));
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "invalid");
  const v = clean(parsed.data);
  if (!v.name) return bad("Name is required");
  const [row] = await db().insert(schema.projects).values({ ...v, name: v.name, profileId: pid }).returning();
  return NextResponse.json({ project: row }, { status: 201 });
}
