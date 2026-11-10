import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { decrypt, encrypt } from "./crypto";
import { maskSecret } from "./mask";
import { isFiat, profileFiat, type Fiat } from "@/lib/fiat";
import { DEFAULT_PROFILE_NAME, DEFAULT_PROFILE_TZ, isProfileId, isTimeZone, type ProfileId } from "@/lib/profiles";

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

type StoredProfile = { name?: string; tz?: string; fiat?: string };

/** Display name of a profile (Settings → Profile). */
export async function getProfileName(pid: ProfileId): Promise<string> {
  return (await getProfileInfo(pid)).name;
}

/** Name + time zone of a profile, with per-profile defaults (Iya and Rizka: Asia/Jakarta, Nadine: Asia/Manila). */
export async function getProfileInfo(pid: ProfileId): Promise<{ name: string; tz: string; fiat: Fiat }> {
  const v = (await getSetting<StoredProfile>(pid, "profile")) ?? {};
  return { name: v.name?.trim() || DEFAULT_PROFILE_NAME[pid], tz: isTimeZone(v.tz) ? v.tz : DEFAULT_PROFILE_TZ[pid], fiat: isFiat(v.fiat) ? v.fiat : profileFiat(pid) };
}

/** Zone used for a profile's day boundary on the server (digest, backups). */
export async function getProfileTz(pid: string): Promise<string> {
  return isProfileId(pid) ? (await getProfileInfo(pid)).tz : DEFAULT_PROFILE_TZ.default;
}

/** Default display currency of a profile (IDR for Iya, PHP for Nadine unless changed). */
export async function getProfileFiat(pid: string): Promise<Fiat> {
  return isProfileId(pid) ? (await getProfileInfo(pid)).fiat : "idr";
}

export async function saveProfileInfo(pid: ProfileId, patch: { name?: string; tz?: string; fiat?: Fiat }) {
  const cur = (await getSetting<StoredProfile>(pid, "profile")) ?? {};
  const next: StoredProfile = { ...cur };
  if (patch.name !== undefined) next.name = patch.name.trim().slice(0, 40);
  if (patch.tz !== undefined && isTimeZone(patch.tz)) next.tz = patch.tz;
  if (patch.fiat !== undefined && isFiat(patch.fiat)) next.fiat = patch.fiat;
  await setSetting(pid, "profile", next);
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
