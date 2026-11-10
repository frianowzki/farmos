import { NextResponse } from "next/server";
import { bad, requireSession } from "@/lib/server/guard";
import { buildDigest, getNotify, renderDigest, sendDigest } from "@/lib/server/telegram";

export async function POST() {
  const denied = await requireSession();
  if (denied) return denied;
  try {
    const r = await sendDigest({ force: true, test: true });
    if (r !== "sent") return bad(r, 412);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return bad(`Telegram: ${(e as Error).message}`, 502);
  }
}

/** Preview today's digest without sending (HTML as Telegram would render it). */
export async function GET() {
  const denied = await requireSession();
  if (denied) return denied;
  const n = await getNotify();
  return NextResponse.json({ text: renderDigest(await buildDigest(n)) });
}
