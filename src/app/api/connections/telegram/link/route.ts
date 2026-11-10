import { NextResponse } from "next/server";
import { bad, requireSession } from "@/lib/server/guard";
import { isConfigured } from "@/lib/server/connections";
import { checkTelegramLink, startTelegramLink } from "@/lib/server/telegram-link";

export const dynamic = "force-dynamic";

/** POST: issue a one-time deep link. GET ?token=: poll whether /start <token> reached the bot. */
export async function POST() {
  const denied = await requireSession();
  if (denied) return denied;
  if (!isConfigured("telegram")) return bad("Telegram is not configured", 412);
  const bot = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME!.replace(/^@/, "");
  const { token, expiresAt } = await startTelegramLink();
  return NextResponse.json({ url: `https://t.me/${bot}?start=${token}`, app: `tg://resolve?domain=${bot}&start=${token}`, token, expiresAt });
}

export async function GET(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  if (!isConfigured("telegram")) return bad("Telegram is not configured", 412);
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!/^[a-f0-9]{32}$/.test(token)) return bad("Bad token", 400);
  return NextResponse.json(await checkTelegramLink(token));
}
