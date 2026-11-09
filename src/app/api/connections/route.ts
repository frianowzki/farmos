import { NextResponse } from "next/server";
import { googleConfigured } from "@/auth";
import { requireSession } from "@/lib/server/guard";
import { PROVIDERS, isConfigured, listConnections } from "@/lib/server/connections";
import { db, schema } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireSession();
  if (denied) return denied;
  const [rows, google] = await Promise.all([listConnections(), db().select().from(schema.googleTokens).limit(1)]);
  const providers = PROVIDERS.map((p) => {
    const configured = p.id === "google" ? googleConfigured : isConfigured(p.id);
    const row = rows.find((r) => r.provider === p.id);
    const account =
      p.id === "google"
        ? google[0]
          ? { username: google[0].email, name: google[0].email, image: null }
          : null
        : row
          ? { username: row.username, name: row.name, image: row.image }
          : null;
    // Env var *names* only (never values) so Settings can show exactly what is missing.
    return { id: p.id, label: p.label, purpose: p.purpose, env: p.env, missing: p.env.filter((k) => !process.env[k]), configured, connected: Boolean(account), account };
  });
  return NextResponse.json({ providers, telegramBot: process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? null });
}
