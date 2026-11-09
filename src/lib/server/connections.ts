import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { decrypt, encrypt } from "@/lib/server/crypto";

export type ProviderId = "google" | "x" | "discord" | "github" | "telegram";

export const PROVIDERS: { id: ProviderId; label: string; env: string[]; purpose: string }[] = [
  { id: "google", label: "Google", env: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"], purpose: "Gmail (read-only) and Calendar sync" },
  { id: "x", label: "X", env: ["X_CLIENT_ID", "X_CLIENT_SECRET"], purpose: "Your X timeline in the Feed (read-only)" },
  { id: "discord", label: "Discord", env: ["DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET"], purpose: "Identity (username and avatar) on your project pages" },
  { id: "github", label: "GitHub", env: ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"], purpose: "Identity and public profile for dev-heavy testnets" },
  { id: "telegram", label: "Telegram", env: ["TELEGRAM_BOT_TOKEN", "NEXT_PUBLIC_TELEGRAM_BOT_USERNAME"], purpose: "Identity via the official Login Widget" },
];

export const isConfigured = (id: ProviderId) => {
  const p = PROVIDERS.find((x) => x.id === id);
  return Boolean(p && p.env.every((k) => process.env[k]) && process.env.AUTH_SECRET);
};

export async function saveConnection(input: {
  provider: Exclude<ProviderId, "google">;
  providerAccountId: string;
  username?: string | null;
  name?: string | null;
  image?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: number | null;
  scope?: string | null;
  profile?: Record<string, unknown>;
}) {
  const row = {
    provider: input.provider,
    providerAccountId: input.providerAccountId,
    username: input.username ?? null,
    name: input.name ?? null,
    image: input.image ?? null,
    accessTokenEnc: input.accessToken ? encrypt(input.accessToken) : null,
    refreshTokenEnc: input.refreshToken ? encrypt(input.refreshToken) : null,
    expiresAt: input.expiresAt ?? null,
    scope: input.scope ?? null,
    profile: input.profile ?? {},
    updatedAt: new Date(),
  };
  await db().insert(schema.connectedAccounts).values(row).onConflictDoUpdate({ target: schema.connectedAccounts.provider, set: row });
}

export async function listConnections() {
  const rows = await db().select().from(schema.connectedAccounts);
  // Public shape only: never tokens.
  return rows.map((r) => ({ provider: r.provider, username: r.username, name: r.name, image: r.image, scope: r.scope, profile: r.profile, updatedAt: r.updatedAt }));
}

export async function removeConnection(provider: string) {
  await db().delete(schema.connectedAccounts).where(eq(schema.connectedAccounts.provider, provider));
}

/** Access token for a provider, refreshing X tokens when they expire (X issues 2h tokens + refresh tokens). */
export async function accessToken(provider: "x" | "discord" | "github"): Promise<string | null> {
  const [row] = await db().select().from(schema.connectedAccounts).where(eq(schema.connectedAccounts.provider, provider)).limit(1);
  if (!row) return null;
  const token = decrypt(row.accessTokenEnc);
  const fresh = !row.expiresAt || row.expiresAt * 1000 > Date.now() + 60_000;
  if (token && fresh) return token;
  if (provider !== "x") return token;
  const refresh = decrypt(row.refreshTokenEnc);
  if (!refresh || !process.env.X_CLIENT_ID || !process.env.X_CLIENT_SECRET) return null;
  const res = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: "Basic " + Buffer.from(`${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`).toString("base64"),
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh }),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { access_token: string; refresh_token?: string; expires_in?: number };
  await db()
    .update(schema.connectedAccounts)
    .set({
      accessTokenEnc: encrypt(j.access_token),
      refreshTokenEnc: j.refresh_token ? encrypt(j.refresh_token) : row.refreshTokenEnc,
      expiresAt: j.expires_in ? Math.floor(Date.now() / 1000) + j.expires_in : null,
      updatedAt: new Date(),
    })
    .where(eq(schema.connectedAccounts.provider, "x"));
  return j.access_token;
}

/** Verify a Telegram Login Widget payload: https://core.telegram.org/widgets/login#checking-authorization */
export function verifyTelegram(data: Record<string, string>): boolean {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !data.hash) return false;
  const { hash, ...rest } = data;
  const check = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${rest[k]}`)
    .join("\n");
  const secret = createHash("sha256").update(token).digest();
  const mac = createHmac("sha256", secret).update(check).digest("hex");
  const age = Date.now() / 1000 - Number(rest.auth_date ?? 0);
  if (!(age >= 0 && age < 86_400)) return false;
  const a = Buffer.from(mac, "hex");
  const b = Buffer.from(String(hash), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
