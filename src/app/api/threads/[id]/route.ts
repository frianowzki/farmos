import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { readJson, requireSession } from "@/lib/server/guard";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, ctx: Ctx) {
  const denied = await requireSession();
  if (denied) return denied;
  const { id } = await ctx.params;
  const [t] = await db().select().from(schema.chatThreads).where(eq(schema.chatThreads.id, id)).limit(1);
  return NextResponse.json({ thread: t ?? null });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const denied = await requireSession();
  if (denied) return denied;
  const { id } = await ctx.params;
  const { title } = await readJson<{ title?: string }>(req);
  await db().update(schema.chatThreads).set({ title: (title ?? "").slice(0, 120) || "Untitled" }).where(eq(schema.chatThreads.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, ctx: Ctx) {
  const denied = await requireSession();
  if (denied) return denied;
  const { id } = await ctx.params;
  await db().delete(schema.chatThreads).where(eq(schema.chatThreads.id, id));
  return NextResponse.json({ ok: true });
}
