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
  ];
  return NextResponse.json({ items });
}
