import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { costsWithValue } from "@/lib/server/costs";
import { bad, readJson, requireProfile } from "@/lib/server/guard";
import { ownsProject } from "@/lib/server/owned";
import { clean, costInput } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

/** This profile's gas / capital / other costs with live value. */
export async function GET() {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  return NextResponse.json({ costs: await costsWithValue(pid) });
}

export async function POST(req: Request) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const parsed = costInput.safeParse(await readJson(req));
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "invalid");
  const v = clean(parsed.data);
  if (!v.projectId || !v.symbol || !v.spentAt || v.amount === undefined) return bad("project, token, amount and date are required");
  if (!(await ownsProject(pid, v.projectId))) return bad("project not found", 404);
  const [row] = await db()
    .insert(schema.costs)
    .values({ profileId: pid, projectId: v.projectId, type: v.type ?? "gas", symbol: v.symbol.toUpperCase(), coinId: v.coinId ?? null, chain: v.chain || null, amount: v.amount, valueAtEntry: v.valueAtEntry ?? null, spentAt: v.spentAt, note: v.note || null })
    .returning();
  return NextResponse.json({ cost: row }, { status: 201 });
}
