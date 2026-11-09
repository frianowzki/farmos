import { NextResponse } from "next/server";
import { bad, requireSession } from "@/lib/server/guard";
import { removeConnection } from "@/lib/server/connections";

type Ctx = { params: Promise<{ provider: string }> };

export async function DELETE(_: Request, ctx: Ctx) {
  const denied = await requireSession();
  if (denied) return denied;
  const { provider } = await ctx.params;
  if (!["x", "discord", "github", "telegram"].includes(provider)) return bad("unknown provider", 404);
  await removeConnection(provider);
  return NextResponse.json({ ok: true });
}
