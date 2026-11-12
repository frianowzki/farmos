import { NextResponse } from "next/server";
import { bad, readJson, requireProfile } from "@/lib/server/guard";
import { isConfigured, removeConnection, saveConnection, verifyTelegram } from "@/lib/server/connections";

/** Receives the Telegram Login Widget payload and verifies its HMAC with the bot token. */
export async function POST(req: Request) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  if (!isConfigured("telegram")) return bad("Telegram is not configured", 412);
  const raw = await readJson<Record<string, unknown>>(req);
  const data: Record<string, string> = {};
  for (const k of ["id", "first_name", "last_name", "username", "photo_url", "auth_date", "hash"]) if (raw[k] != null) data[k] = String(raw[k]);
  if (!verifyTelegram(data)) return bad("Telegram signature check failed", 401);
  await saveConnection(pid, {
    provider: "telegram",
    providerAccountId: data.id,
    username: data.username ?? null,
    name: [data.first_name, data.last_name].filter(Boolean).join(" ") || null,
    image: data.photo_url ?? null,
  });
  return NextResponse.json({ ok: true });
}

/**
 * Unlink Telegram. A static route segment beats `[provider]`, so this handler has to exist here
 * as well — otherwise `DELETE /api/connections/telegram` falls through to a file that only
 * exports POST and the client gets a 405.
 */
export async function DELETE() {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  await removeConnection(pid, "telegram");
  return NextResponse.json({ ok: true });
}
