import { NextResponse } from "next/server";
import { bad, requireProfile } from "@/lib/server/guard";
import { buildDigest, getNotify, renderDigest, sendDigest } from "@/lib/server/telegram";

export async function POST() {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  try {
    const r = await sendDigest(pid, { force: true, test: true });
    if (r !== "sent") return bad(r, 412);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return bad(`Telegram: ${(e as Error).message}`, 502);
  }
}

/** Preview today's digest without sending (HTML as Telegram would render it). */
export async function GET() {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const n = await getNotify(pid);
  return NextResponse.json({ text: renderDigest(await buildDigest(pid, n)) });
}
