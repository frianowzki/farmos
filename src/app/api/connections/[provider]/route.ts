import { NextResponse } from "next/server";
import { bad, requireProfile } from "@/lib/server/guard";
import { removeConnection } from "@/lib/server/connections";

type Ctx = { params: Promise<{ provider: string }> };

export async function DELETE(_: Request, ctx: Ctx) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const { provider } = await ctx.params;
  if (!["x", "discord", "github", "telegram", "farcaster"].includes(provider)) return bad("unknown provider", 404);
  await removeConnection(pid, provider);
  return NextResponse.json({ ok: true });
}
