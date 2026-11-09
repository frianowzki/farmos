import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { readJson, requireSession } from "@/lib/server/guard";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const denied = await requireSession();
  if (denied) return denied;
  const { id } = await ctx.params;
  const { label } = await readJson<{ label?: string }>(req);
  const [row] = await db().update(schema.wallets).set({ label: (label ?? "").slice(0, 60) }).where(eq(schema.wallets.id, id)).returning();
  return NextResponse.json({ wallet: row });
}

export async function DELETE(_: Request, ctx: Ctx) {
  const denied = await requireSession();
  if (denied) return denied;
  const { id } = await ctx.params;
  await db().delete(schema.wallets).where(eq(schema.wallets.id, id));
  return NextResponse.json({ ok: true });
}
