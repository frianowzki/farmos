import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { bad, readJson, requireSession } from "@/lib/server/guard";
import { clean, projectInput } from "@/lib/server/validate";

export async function GET() {
  const denied = await requireSession();
  if (denied) return denied;
  const [projects, positions] = await Promise.all([
    db().select().from(schema.projects).orderBy(desc(schema.projects.updatedAt)),
    db().select().from(schema.positions),
  ]);
  return NextResponse.json({ projects, positions });
}

export async function POST(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  const parsed = projectInput.safeParse(await readJson(req));
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "invalid");
  const v = clean(parsed.data);
  if (!v.name) return bad("Name is required");
  const [row] = await db().insert(schema.projects).values({ ...v, name: v.name }).returning();
  return NextResponse.json({ project: row }, { status: 201 });
}
