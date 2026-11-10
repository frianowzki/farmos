import { NextResponse } from "next/server";
import { generateText } from "ai";
import { z } from "zod";
import { aiModel } from "@/lib/server/ai";
import { bad, readJson, requireProfile } from "@/lib/server/guard";

export const maxDuration = 30;

const Body = z.object({ title: z.string().min(2).max(300), summary: z.string().max(1200).catch(""), source: z.string().max(80).catch("") });

/** One-line "why it matters" for a headline, written for an airdrop / onchain farmer. */
export async function POST(req: Request) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const b = Body.safeParse(await readJson(req));
  if (!b.success) return bad("Invalid item");
  let model;
  try {
    model = await aiModel(pid);
  } catch (e) {
    return bad((e as Error).message, 412);
  }
  try {
    const { text } = await generateText({
      model,
      system: "You write one-line takeaways for a crypto airdrop and onchain farmer. Plain text, no markdown, no emojis, no hype, max 28 words. Use only the facts given. If it has no practical angle, say what to watch instead.",
      prompt: `Headline: ${b.data.title}\nSource: ${b.data.source}\nSummary: ${b.data.summary.slice(0, 900)}\n\nWhy does this matter to me? One sentence.`,
      maxOutputTokens: 90,
    });
    return NextResponse.json({ why: text.replace(/\s+/g, " ").trim().slice(0, 260) });
  } catch (e) {
    return bad((e as Error).message.slice(0, 200), 502);
  }
}
