import { NextResponse } from "next/server";
import { generateText, isStepCount } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { aiModel, aiToolsEnabled, buildTools, systemFor } from "@/lib/server/ai";
import { bad, readJson, requireProfile } from "@/lib/server/guard";
import { getNews } from "@/lib/server/news";

export const maxDuration = 300;

const Item = z.object({
  kind: z.enum(["news", "project"]).catch("project"),
  title: z.string().min(2).max(160),
  summary: z.string().max(600).catch(""),
  url: z.string().url().nullable().catch(null),
  source: z.string().max(80).nullable().catch(null),
  category: z.enum(["airdrop", "testnet", "nft", "degen", "news"]).nullable().catch(null),
  score: z.coerce.number().int().min(0).max(100).catch(50),
});

const INSTRUCTIONS = `Build today's reading list for the user's crypto workspace.
Use your tools first: DefiLlama raises and protocols, CoinGecko trending, GeckoTerminal new/trending pools, and the user's existing projects (skip ones they already track unless there's a new action).
Return 6–9 items. Every item MUST come from something a tool returned this session, with a real source URL (official site, DefiLlama, CoinGecko, GeckoTerminal, docs). Never invent projects, links or numbers.
"score" is your conviction 0–100 that it's worth the user's time today.
Reply with ONLY a JSON array, no prose, no code fences. Shape:
[{"kind":"project"|"news","title":"…","summary":"one or two sentences: what it is and why today","url":"https://…","source":"DefiLlama","category":"airdrop"|"testnet"|"nft"|"degen"|"news","score":72}]`;

export async function POST(req: Request) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const { day } = await readJson<{ day?: string }>(req);
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return bad("day required");
  let model;
  try {
    model = await aiModel(pid);
  } catch (e) {
    return bad((e as Error).message, 412);
  }
  const useTools = await aiToolsEnabled(pid);
  // Free newsroom + airdrop-tracker RSS headlines count as tool data: the model may pick from them.
  const news = await getNews(false).catch(() => null);
  const wire = (news?.items ?? [])
    .slice(0, 60)
    .map((n) => `- [${n.category}] ${n.title} | ${n.source} | ${n.url}${n.summary ? ` | ${n.summary.slice(0, 160)}` : ""}`)
    .join("\n");
  const prompt = wire
    ? `${INSTRUCTIONS}\n\nLatest headlines from CoinDesk, The Block, Decrypt, Cointelegraph, The Defiant, Blockworks, Bankless, DL News, Cryptonews, Bitcoin Magazine, Airdrops.io and Airdrop Alert (these count as tool data; use their URLs as-is, mix 2–4 of the most actionable ones in, airdrop/testnet ones first):\n${wire}`
    : INSTRUCTIONS;
  const result = await generateText({
    model,
    system: systemFor("daily"),
    prompt,
    ...(useTools ? { tools: buildTools(pid), stopWhen: isStepCount(8) } : {}),
  });
  const text = result.text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  let parsed: z.infer<typeof Item>[] = [];
  try {
    const arr = JSON.parse(text.slice(start, end + 1)) as unknown[];
    parsed = arr.map((x) => Item.safeParse(x)).filter((r) => r.success).map((r) => r.data!).slice(0, 10);
  } catch {
    return bad("The model didn't return a usable list. Try again, or check the model supports tools.", 502);
  }
  if (!parsed.length) return bad("No items came back. Try again.", 502);
  await db().delete(schema.feedItems).where(and(eq(schema.feedItems.profileId, pid), eq(schema.feedItems.day, day)));
  const rows = await db()
    .insert(schema.feedItems)
    .values(parsed.map((p) => ({ ...p, day, category: p.category ?? null, profileId: pid })))
    .returning();
  return NextResponse.json({ items: rows });
}
