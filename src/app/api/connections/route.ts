import { NextResponse } from "next/server";
import { googleConfigured } from "@/auth";
import { requireProfile } from "@/lib/server/guard";
import { PROVIDERS, isConfigured, listConnections } from "@/lib/server/connections";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const [rows, google] = await Promise.all([listConnections(pid), db().select().from(schema.googleTokens).where(eq(schema.googleTokens.id, pid)).limit(1)]);
  const providers = PROVIDERS.map((p) => {
    // Google (Gmail/Calendar) stays on Iya's default profile only.
    const configured = p.id === "google" ? googleConfigured && pid === "default" : isConfigured(p.id);
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
