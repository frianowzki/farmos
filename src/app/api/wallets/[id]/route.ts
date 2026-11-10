import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { readJson, requireSession } from "@/lib/server/guard";
import { isWalletBrand } from "@/lib/wallet-brands";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const denied = await requireSession();
  if (denied) return denied;
  const { id } = await ctx.params;
  const { label, provider } = await readJson<{ label?: string; provider?: string }>(req);
  const set: { label?: string; provider?: string } = {};
  if (typeof label === "string") set.label = label.slice(0, 60);
  if (typeof provider === "string") set.provider = isWalletBrand(provider) ? provider : "";
  if (!Object.keys(set).length) return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  const [row] = await db().update(schema.wallets).set(set).where(eq(schema.wallets.id, id)).returning();
  return NextResponse.json({ wallet: row });
}

export async function DELETE(_: Request, ctx: Ctx) {
  const denied = await requireSession();
  if (denied) return denied;
  const { id } = await ctx.params;
  await db().delete(schema.wallets).where(eq(schema.wallets.id, id));
  return NextResponse.json({ ok: true });
}
