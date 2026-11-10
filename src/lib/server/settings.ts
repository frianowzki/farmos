import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { decrypt, encrypt } from "./crypto";
import { maskSecret } from "./mask";

type StoredAi = { baseUrl?: string; model?: string; apiKeyEnc?: string; tools?: boolean };

export async function getSetting<T>(key: string): Promise<T | null> {
  const rows = await db().select().from(schema.settings).where(eq(schema.settings.key, key)).limit(1);
  return (rows[0]?.value as T) ?? null;
}

export async function setSetting(key: string, value: unknown) {
  await db()
    .insert(schema.settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: new Date() } });
}

export type AiConfig = { baseUrl: string; model: string; apiKey: string | null; source: "settings" | "env" | "none" };

export async function getAiConfig(): Promise<AiConfig> {
  const s = (await getSetting<StoredAi>("ai")) ?? {};
  const baseUrl = s.baseUrl || process.env.AI_BASE_URL || "";
  const model = s.model || process.env.AI_MODEL || "";
  const apiKey = decrypt(s.apiKeyEnc) || process.env.AI_API_KEY || null;
  const source = s.baseUrl ? "settings" : process.env.AI_BASE_URL ? "env" : "none";
  return { baseUrl, model, apiKey, source };
}

/** Public, key-free view for the client. */
export async function getAiConfigPublic() {
  const s = (await getSetting<StoredAi>("ai")) ?? {};
  const c = await getAiConfig();
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

export async function saveAiConfig(input: { baseUrl?: string; model?: string; apiKey?: string | null; tools?: boolean }) {
  const s = (await getSetting<StoredAi>("ai")) ?? {};
  const next: StoredAi = {
    baseUrl: input.baseUrl?.trim() ?? s.baseUrl,
    model: input.model?.trim() ?? s.model,
    apiKeyEnc: s.apiKeyEnc,
    tools: input.tools ?? s.tools,
  };
  if (input.apiKey === null) delete next.apiKeyEnc;
  else if (input.apiKey && input.apiKey.trim()) next.apiKeyEnc = encrypt(input.apiKey.trim());
  await setSetting("ai", next);
}
