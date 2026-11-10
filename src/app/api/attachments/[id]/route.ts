import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { bad, requireProfile } from "@/lib/server/guard";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_: Request, ctx: Ctx) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return bad("not found", 404);
  const [row] = await db().delete(schema.attachments).where(and(eq(schema.attachments.profileId, pid), eq(schema.attachments.id, id))).returning();
  if (row) await del(row.url).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
