import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { bad, readJson, requireSession } from "@/lib/server/guard";
import { findStartChat, getNotify, publicNotify, saveNotify, sendTelegram } from "@/lib/server/telegram";

/** Step 1: mint a one-time token and return the t.me deep link. */
export async function POST(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  if (!process.env.TELEGRAM_BOT_TOKEN) return bad("Telegram bot is not configured", 412);
  const { mode } = await readJson<{ mode?: string }>(req);

  // Shortcut: reuse the Telegram account from Connected accounts (private chat id == user id).
  if (mode === "connected") {
    const [acc] = await db().select().from(schema.connectedAccounts).where(eq(schema.connectedAccounts.provider, "telegram")).limit(1);
    if (!acc) return bad("Connect Telegram under Connected accounts first", 412);
    try {
      await sendTelegram(acc.providerAccountId, "farmOS notifications are linked to this chat.");
    } catch {
      return bad("The bot can't message you yet. Open the bot and press Start, then try again.", 409);
    }
    return NextResponse.json(publicNotify(await saveNotify({ chatId: acc.providerAccountId, chatName: acc.username ? `@${acc.username}` : acc.name, linkToken: null })));
  }

  const token = randomBytes(12).toString("hex");
  await saveNotify({ linkToken: token, linkTokenAt: new Date().toISOString() });
  const bot = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  return NextResponse.json({ url: bot ? `https://t.me/${bot}?start=${token}` : null, token });
}

/** Step 2: look for the /start <token> message and save that chat. */
export async function PUT() {
  const denied = await requireSession();
  if (denied) return denied;
  const n = await getNotify();
  if (!n.linkToken) return bad("Start linking first", 400);
  if (n.linkTokenAt && Date.now() - +new Date(n.linkTokenAt) > 30 * 60_000) return bad("Link expired, start again", 410);
  let hit;
  try {
    hit = await findStartChat(n.linkToken);
  } catch (e) {
    return bad(`Telegram: ${(e as Error).message}`, 502);
  }
  if (!hit) return NextResponse.json({ ...publicNotify(n), waiting: true });
  const next = await saveNotify({ chatId: hit.chatId, chatName: hit.name, linkToken: null });
  await sendTelegram(hit.chatId, "farmOS notifications are linked to this chat. Daily digest arrives at 07:00 WIB.").catch(() => null);
  return NextResponse.json(publicNotify(next));
}
