import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { bad, requireProfile } from "@/lib/server/guard";
import { getDrop, openseaConfigured } from "@/lib/server/opensea";

type Ctx = { params: Promise<{ slug: string }> };

/** Turn a drop into an NFT project page (mint date, chain, OpenSea link). */
export async function POST(_: Request, ctx: Ctx) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  if (!openseaConfigured()) return bad("OPENSEA_API_KEY is not set", 412);
  const { slug } = await ctx.params;
  if (!/^[a-z0-9-_.]{1,120}$/i.test(slug)) return bad("bad slug");
  const [w] = await db().select().from(schema.mintWatch).where(and(eq(schema.mintWatch.profileId, pid), eq(schema.mintWatch.slug, slug)));
  if (w?.projectId) return NextResponse.json({ projectId: w.projectId });
  const d = await getDrop(slug).catch((e: Error) => e);
  if (d instanceof Error) return bad(d.message, 502);
  const start = d.next_stage?.start_time ?? d.active_stage?.start_time ?? d.stages.map((s) => s.start_time).sort()[0];
  const [p] = await db()
    .insert(schema.projects)
    .values({
      name: d.collection_name ?? slug,
      category: "nft",
      status: "research",
      chains: [d.chain],
      links: { site: d.opensea_url },
      keyDates: { mint: start ? start.slice(0, 10) : null },
      deadline: start ? start.slice(0, 10) : null,
      source: "OpenSea drops",
      tags: ["mint"],
      profileId: pid,
    })
    .returning();
  await db().insert(schema.mintWatch).values({ slug, name: d.collection_name, chain: d.chain, contract: d.contract_address, projectId: p.id, profileId: pid }).onConflictDoUpdate({ target: [schema.mintWatch.profileId, schema.mintWatch.slug], set: { projectId: p.id, updatedAt: new Date() } });
  return NextResponse.json({ projectId: p.id }, { status: 201 });
}
