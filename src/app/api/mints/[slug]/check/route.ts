import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { bad, requireSession } from "@/lib/server/guard";
import { checkEligibility, getDrop, openseaConfigured } from "@/lib/server/opensea";

export const maxDuration = 60;
type Ctx = { params: Promise<{ slug: string }> };

/** Auto-check every saved wallet against the drop's public / on-chain allowlist data. Reads only. */
export async function POST(_: Request, ctx: Ctx) {
  const denied = await requireSession();
  if (denied) return denied;
  if (!openseaConfigured()) return bad("OPENSEA_API_KEY is not set", 412);
  const { slug } = await ctx.params;
  if (!/^[a-z0-9-_.]{1,120}$/i.test(slug)) return bad("bad slug");
  const wallets = await db().select().from(schema.wallets);
  if (!wallets.length) return bad("Add a wallet on the Wallets page first", 412);
  let drop;
  try {
    drop = await getDrop(slug);
  } catch (e) {
    return bad((e as Error).message, 502);
  }
  const result = await checkEligibility(drop, wallets);
  const start = drop.next_stage?.start_time ?? drop.active_stage?.start_time ?? drop.stages[0]?.start_time;
  const values = { name: drop.collection_name, chain: drop.chain, contract: drop.contract_address, startTime: start ? new Date(start) : null, auto: result as never, checkedAt: new Date() };
  await db().insert(schema.mintWatch).values({ slug, ...values }).onConflictDoUpdate({ target: schema.mintWatch.slug, set: { ...values, updatedAt: new Date() } });
  return NextResponse.json({ result });
}
