import { NextResponse } from "next/server";
import { dashboardTools } from "@/lib/server/ai";
import { bad, readJson, requireProfile } from "@/lib/server/guard";

/**
 * Test-only: runs one research-desk dashboard tool for the signed-in profile so the isolation suite can
 * check scoping without an AI model. Disabled (404) unless AI_TOOL_PROBE=1, which is never set on Vercel.
 */
export async function POST(req: Request) {
  if (process.env.AI_TOOL_PROBE !== "1" || process.env.VERCEL) return new NextResponse("Not found", { status: 404 });
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const { tool, args } = await readJson<{ tool?: string; args?: Record<string, unknown> }>(req);
  const tools = dashboardTools(pid) as unknown as Record<string, { execute?: (a: unknown, o: unknown) => Promise<unknown> }>;
  const t = tool ? tools[tool] : undefined;
  if (!t?.execute) return bad("unknown tool");
  const out = await t.execute(args ?? {}, { toolCallId: "probe", messages: [] });
  return NextResponse.json({ out });
}
