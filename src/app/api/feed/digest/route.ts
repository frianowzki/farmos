import { streamText } from "ai";
import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { aiModel, systemFor } from "@/lib/server/ai";
import { bad, readJson, requireSession } from "@/lib/server/guard";

export const maxDuration = 120;

/** Streams a short AI digest of the reading list (today's, or the latest day). Plain text/markdown stream. */
export async function POST(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  const { day } = await readJson<{ day?: string }>(req);
  let model;
  try {
    model = await aiModel();
  } catch (e) {
    return bad((e as Error).message, 412);
  }
  const rows = await db().select().from(schema.feedItems).orderBy(desc(schema.feedItems.day), desc(schema.feedItems.score)).limit(60);
  const pick = day && rows.some((r) => r.day === day) ? day : rows[0]?.day;
  const items = rows.filter((r) => r.day === pick).map((r) => ({ title: r.title, summary: r.summary, category: r.category, source: r.source, url: r.url }));
  if (!items.length) return bad("No reading list yet. Build today's list first.", 404);
  const result = streamText({
    model,
    system: systemFor("chat"),
    prompt: `Here is my reading list for ${pick} (JSON): ${JSON.stringify(items)}

Write a tight briefing in markdown:
- One line "**Mood:**" on the overall market/ecosystem tone from these items.
- "**Act on**": up to 3 bullets of what's worth my time today and the concrete next step (no transaction instructions).
- "**Skip / watch**": up to 3 bullets with why.
Use only facts in the items; link sources inline with markdown when a URL is given. Max 170 words.`,
  });
  return result.toTextStreamResponse();
}
