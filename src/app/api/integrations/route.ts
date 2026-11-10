import { NextResponse } from "next/server";
import { requireSession } from "@/lib/server/guard";

export const dynamic = "force-dynamic";

/** Which optional server-side keys are present. Booleans only. */
export async function GET() {
  const denied = await requireSession();
  if (denied) return denied;
  const has = (k: string) => Boolean(process.env[k]?.trim());
  const items = [
    { id: "opensea", label: "OpenSea", env: "OPENSEA_API_KEY", ok: has("OPENSEA_API_KEY"), note: "Upcoming mints and live-stage allowlist checks" },
    { id: "etherscan", label: "Etherscan (v2, all chains)", env: "ETHERSCAN_API_KEY", ok: has("ETHERSCAN_API_KEY"), note: "Contract verification in audits, full-history allowlist logs" },
    { id: "blob", label: "Vercel Blob", env: "BLOB_READ_WRITE_TOKEN", ok: has("BLOB_READ_WRITE_TOKEN"), note: "Private attachments on projects and diary" },
    { id: "walletconnect", label: "WalletConnect", env: "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID", ok: has("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID"), note: "QR / mobile wallets (injected wallets work without it)" },
    { id: "google", label: "Google", env: "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ALLOWED_EMAIL", ok: has("GOOGLE_CLIENT_ID") && has("GOOGLE_CLIENT_SECRET") && has("ALLOWED_EMAIL"), note: "Gmail (read-only), Calendar, and Google sign-in unlock" },
    { id: "x", label: "X", env: "X_CLIENT_ID, X_CLIENT_SECRET", ok: has("X_CLIENT_ID") && has("X_CLIENT_SECRET"), note: "X connection and Feed timeline" },
    { id: "discord", label: "Discord", env: "DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET", ok: has("DISCORD_CLIENT_ID") && has("DISCORD_CLIENT_SECRET"), note: "Discord identity on your profile" },
    { id: "github", label: "GitHub", env: "GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET", ok: has("GITHUB_CLIENT_ID") && has("GITHUB_CLIENT_SECRET"), note: "GitHub identity and public profile" },
    { id: "telegram", label: "Telegram", env: "TELEGRAM_BOT_TOKEN, NEXT_PUBLIC_TELEGRAM_BOT_USERNAME", ok: has("TELEGRAM_BOT_TOKEN") && has("NEXT_PUBLIC_TELEGRAM_BOT_USERNAME"), note: "Telegram Login Widget" },
  ];
  return NextResponse.json({ items });
}
