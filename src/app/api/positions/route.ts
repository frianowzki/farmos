import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { bad, readJson, requireSession } from "@/lib/server/guard";
import { clean, positionInput } from "@/lib/server/validate";

export async function POST(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  const parsed = positionInput.safeParse(await readJson(req));
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "invalid");
  const v = clean(parsed.data);
  if (!v.projectId || !v.token) return bad("projectId and token are required");
  const [row] = await db().insert(schema.positions).values({ ...v, projectId: v.projectId, token: v.token }).returning();
  return NextResponse.json({ position: row }, { status: 201 });
}
