import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { getSetting, setSetting } from "./settings";
import { saveConnection } from "./connections";

/**
 * Deep-link linking, no Login Widget needed: farmOS issues a one-time token, Iya opens
 * t.me/<bot>?start=<token> and taps Start, and the server finds that /start message via the
 * Bot API (getUpdates). The token is stored hashed and expires after 10 minutes.
 */
const KEY = "telegram_link";
const TTL_MS = 10 * 60_000;
type Pending = { hash: string; exp: number };

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export async function startTelegramLink() {
  const token = randomBytes(16).toString("hex");
  await setSetting(KEY, { hash: sha(token), exp: Date.now() + TTL_MS } satisfies Pending);
  return { token, expiresAt: Date.now() + TTL_MS };
}

type Update = { update_id: number; message?: { text?: string; chat?: { id: number; type: string }; from?: { id: number; is_bot?: boolean; first_name?: string; last_name?: string; username?: string } } };

async function bot<T>(method: string, body: Record<string, unknown>): Promise<{ ok: boolean; result?: T; description?: string; error_code?: number }> {
  const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  return r.json();
}

/** Checks for the /start message. Returns linked user, "pending", or an error string. */
export async function checkTelegramLink(token: string): Promise<{ status: "linked"; username: string | null } | { status: "pending" } | { status: "error"; error: string }> {
  const p = await getSetting<Pending>(KEY);
  if (!p || p.hash !== sha(token)) return { status: "error", error: "Link expired. Start again." };
  if (Date.now() > p.exp) return { status: "error", error: "Link expired. Start again." };
  const res = await bot<Update[]>("getUpdates", { timeout: 0, allowed_updates: ["message"] });
  if (!res.ok) {
    if (res.error_code === 409) return { status: "error", error: "The bot has a webhook set, so updates can't be read. Remove it with deleteWebhook, then try again." };
    return { status: "error", error: res.description ?? "Telegram API error" };
  }
  const updates = res.result ?? [];
  const hit = updates.find((u) => u.message?.text?.trim() === `/start ${token}` && u.message.from && !u.message.from.is_bot);
  // Acknowledge what we've read so the queue doesn't grow.
  const last = updates.at(-1)?.update_id;
  if (last != null) await bot("getUpdates", { offset: last + 1, timeout: 0 }).catch(() => null);
  if (!hit?.message?.from) return { status: "pending" };
  const f = hit.message.from;
  await saveConnection({
    provider: "telegram",
    providerAccountId: String(f.id),
    username: f.username ?? null,
    name: [f.first_name, f.last_name].filter(Boolean).join(" ") || null,
    image: null,
  });
  await setSetting(KEY, { hash: "", exp: 0 } satisfies Pending);
  // Same private chat works for notifications; link it too if none is set yet.
  const { getNotify, saveNotify } = await import("./telegram");
  const n = await getNotify().catch(() => null);
  if (n && !n.chatId && hit.message.chat?.type === "private") await saveNotify({ chatId: String(hit.message.chat.id), chatName: f.username ? `@${f.username}` : f.first_name ?? null }).catch(() => null);
  if (hit.message.chat?.id) await bot("sendMessage", { chat_id: hit.message.chat.id, text: "Linked to farmOS. You can close this chat." }).catch(() => null);
  return { status: "linked", username: f.username ?? null };
}
