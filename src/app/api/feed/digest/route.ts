import { NextResponse } from "next/server";
import { streamText } from "ai";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { aiModel, systemFor } from "@/lib/server/ai";
import { bad, readJson, requireProfile } from "@/lib/server/guard";
import { getNews } from "@/lib/server/news";

export const maxDuration = 120;

/** Streams a short AI digest of the reading list (today's, or the latest day). Plain text/markdown stream. */
export async function POST(req: Request) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const { day, category, from, source } = await readJson<{ day?: string; category?: string; from?: "list" | "wire"; source?: string }>(req);
  let model;
  try {
    model = await aiModel(pid);
  } catch (e) {
    return bad((e as Error).message, 412);
  }
  if (from === "wire") {
    const wire = await getNews(false);
    const items = wire.items
      .filter((n) => (!category || category === "all" || n.category === category) && (!source || source === "all" || n.sourceId === source))
      .slice(0, 40)
      .map((n) => ({ title: n.title, summary: n.summary.slice(0, 200), category: n.category, source: n.source, url: n.url, at: n.publishedAt }));
    if (!items.length) return bad("No headlines match this filter.", 404);
    const result = streamText({
      model,
      system: systemFor("chat"),
      prompt: `Latest crypto headlines${category && category !== "all" ? ` (only ${category})` : ""} (JSON): ${JSON.stringify(items)}

Write a tight briefing in markdown:
- One line "**Mood:**" on the market tone from these headlines.
- "**What matters**": up to 4 bullets, each one story and why it matters to an airdrop/onchain farmer. Group duplicates across outlets.
- "**Act on**": up to 2 concrete next steps (no transaction instructions).
Use only facts in the items; link sources inline with markdown. Max 180 words.`,
    });
    return result.toTextStreamResponse();
  }
  const rows = await db().select().from(schema.feedItems).where(eq(schema.feedItems.profileId, pid)).orderBy(desc(schema.feedItems.day), desc(schema.feedItems.score)).limit(60);
  const pick = day && rows.some((r) => r.day === day) ? day : rows[0]?.day;
  const items = rows.filter((r) => r.day === pick && (!category || category === "all" || (r.category ?? "news") === category)).map((r) => ({ title: r.title, summary: r.summary, category: r.category, source: r.source, url: r.url }));
  if (!items.length) return bad(category && category !== "all" ? "Nothing in this category today." : "No reading list yet. Build today's list first.", 404);
  const result = streamText({
    model,
    system: systemFor("chat"),
    prompt: `Here is my reading list for ${pick}${category && category !== "all" ? ` (only the ${category} items)` : ""} (JSON): ${JSON.stringify(items)}

Write a tight briefing in markdown:
- One line "**Mood:**" on the overall market/ecosystem tone from these items.
- "**Act on**": up to 3 bullets of what's worth my time today and the concrete next step (no transaction instructions).
- "**Skip / watch**": up to 3 bullets with why.
Use only facts in the items; link sources inline with markdown when a URL is given. Max 170 words.`,
  });
  return result.toTextStreamResponse();
}
