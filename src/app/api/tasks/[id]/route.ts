import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { bad, readJson, requireSession } from "@/lib/server/guard";
import { clean, taskInput } from "@/lib/server/validate";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const denied = await requireSession();
  if (denied) return denied;
  const { id } = await ctx.params;
  const parsed = taskInput.safeParse(await readJson(req));
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "invalid");
  const [row] = await db().update(schema.tasks).set(clean(parsed.data)).where(eq(schema.tasks.id, id)).returning();
  if (!row) return bad("not found", 404);
  return NextResponse.json({ task: row });
}

export async function DELETE(_: Request, ctx: Ctx) {
  const denied = await requireSession();
  if (denied) return denied;
  const { id } = await ctx.params;
  await db().delete(schema.tasks).where(eq(schema.tasks.id, id));
  return NextResponse.json({ ok: true });
}
