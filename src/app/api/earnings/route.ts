import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { earningsWithValue } from "@/lib/server/earnings";
import { bad, readJson, requireProfile } from "@/lib/server/guard";
import { ownsProject } from "@/lib/server/owned";
import { clean, earningInput } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

/** All of this profile's received tokens with current value from live prices. */
export async function GET() {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  return NextResponse.json({ earnings: await earningsWithValue(pid) });
}

export async function POST(req: Request) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const parsed = earningInput.safeParse(await readJson(req));
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "invalid");
  const v = clean(parsed.data);
  if (!v.projectId || !v.symbol || !v.claimedAt || v.amount === undefined) return bad("project, symbol, amount and date are required");
  if (!(await ownsProject(pid, v.projectId))) return bad("project not found", 404);
  const [row] = await db()
    .insert(schema.earnings)
    .values({ profileId: pid, projectId: v.projectId, symbol: v.symbol.toUpperCase(), coinId: v.coinId ?? null, amount: v.amount, valueAtClaim: v.valueAtClaim ?? null, claimedAt: v.claimedAt, wallet: v.wallet || null, note: v.note || null })
    .returning();
  return NextResponse.json({ earning: row }, { status: 201 });
}
