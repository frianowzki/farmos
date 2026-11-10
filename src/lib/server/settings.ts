import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { decrypt, encrypt } from "./crypto";
import { maskSecret } from "./mask";
import { DEFAULT_PROFILE_NAME, type ProfileId } from "@/lib/profiles";

type StoredAi = { baseUrl?: string; model?: string; apiKeyEnc?: string; tools?: boolean };

/** Per-profile setting. `pid` is the session profile (or GLOBAL_PROFILE for shared caches). */
export async function getSetting<T>(pid: string, key: string): Promise<T | null> {
  const rows = await db().select().from(schema.settings).where(and(eq(schema.settings.profileId, pid), eq(schema.settings.key, key))).limit(1);
  return (rows[0]?.value as T) ?? null;
}

export async function setSetting(pid: string, key: string, value: unknown) {
  await db()
    .insert(schema.settings)
    .values({ profileId: pid, key, value })
    .onConflictDoUpdate({ target: [schema.settings.profileId, schema.settings.key], set: { value, updatedAt: new Date() } });
}

/** Display name of a profile (Settings → Profile). */
export async function getProfileName(pid: ProfileId): Promise<string> {
  const v = await getSetting<{ name?: string }>(pid, "profile");
  return v?.name?.trim() || DEFAULT_PROFILE_NAME[pid];
}

export async function setProfileName(pid: ProfileId, name: string) {
  await setSetting(pid, "profile", { name: name.trim().slice(0, 40) });
}

export type AiConfig = { baseUrl: string; model: string; apiKey: string | null; source: "settings" | "env" | "none" };

/** A profile's own AI settings win; otherwise the server env keys (AI_*) are the fallback. */
export async function getAiConfig(pid: string): Promise<AiConfig> {
  const s = (await getSetting<StoredAi>(pid, "ai")) ?? {};
  const baseUrl = s.baseUrl || process.env.AI_BASE_URL || "";
  const model = s.model || process.env.AI_MODEL || "";
  // The server key is only ever sent to the server's own endpoint, never to a profile-chosen URL.
  const envKeyOk = !s.baseUrl || s.baseUrl === process.env.AI_BASE_URL;
  const apiKey = decrypt(s.apiKeyEnc) || (envKeyOk ? process.env.AI_API_KEY : null) || null;
  const source = s.baseUrl ? "settings" : process.env.AI_BASE_URL ? "env" : "none";
  return { baseUrl, model, apiKey, source };
}

/** Public, key-free view for the client. */
export async function getAiConfigPublic(pid: string) {
  const s = (await getSetting<StoredAi>(pid, "ai")) ?? {};
  const c = await getAiConfig(pid);
  return {
    baseUrl: c.baseUrl,
    model: c.model,
    hasKey: Boolean(c.apiKey),
    keyFromSettings: Boolean(s.apiKeyEnc),
    keyMask: maskSecret(c.apiKey),
    source: c.source,
    configured: Boolean(c.baseUrl && c.model),
    tools: s.tools !== false,
    etherscan: Boolean(process.env.ETHERSCAN_API_KEY),
  };
}

export async function saveAiConfig(pid: string, input: { baseUrl?: string; model?: string; apiKey?: string | null; tools?: boolean }) {
  const s = (await getSetting<StoredAi>(pid, "ai")) ?? {};
  const next: StoredAi = {
    baseUrl: input.baseUrl?.trim() ?? s.baseUrl,
    model: input.model?.trim() ?? s.model,
    apiKeyEnc: s.apiKeyEnc,
    tools: input.tools ?? s.tools,
  };
  if (input.apiKey === null) delete next.apiKeyEnc;
  else if (input.apiKey && input.apiKey.trim()) next.apiKeyEnc = encrypt(input.apiKey.trim());
  await setSetting(pid, "ai", next);
}
