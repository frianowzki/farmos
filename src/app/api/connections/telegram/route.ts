import { NextResponse } from "next/server";
import { bad, readJson, requireSession } from "@/lib/server/guard";
import { isConfigured, saveConnection, verifyTelegram } from "@/lib/server/connections";

/** Receives the Telegram Login Widget payload and verifies its HMAC with the bot token. */
export async function POST(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  if (!isConfigured("telegram")) return bad("Telegram is not configured", 412);
  const raw = await readJson<Record<string, unknown>>(req);
  const data: Record<string, string> = {};
  for (const k of ["id", "first_name", "last_name", "username", "photo_url", "auth_date", "hash"]) if (raw[k] != null) data[k] = String(raw[k]);
  if (!verifyTelegram(data)) return bad("Telegram signature check failed", 401);
  await saveConnection({
    provider: "telegram",
    providerAccountId: data.id,
    username: data.username ?? null,
    name: [data.first_name, data.last_name].filter(Boolean).join(" ") || null,
    image: data.photo_url ?? null,
  });
  return NextResponse.json({ ok: true });
}
