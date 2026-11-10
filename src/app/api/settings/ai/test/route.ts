import { NextResponse } from "next/server";
import { generateText } from "ai";
import { requireProfile } from "@/lib/server/guard";
import { aiModel } from "@/lib/server/ai";

export const maxDuration = 30;

export async function POST() {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  try {
    const t0 = Date.now();
    const { text } = await generateText({ model: await aiModel(pid), prompt: "Reply with exactly: pong", maxOutputTokens: 10 });
    return NextResponse.json({ ok: true, reply: text.slice(0, 80), ms: Date.now() - t0 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message.slice(0, 300) }, { status: 200 });
  }
}
