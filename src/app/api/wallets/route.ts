import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { db, schema } from "@/db";
import { bad, readJson, requireSession } from "@/lib/server/guard";
import { isWalletBrand } from "@/lib/wallet-brands";

export async function GET() {
  const denied = await requireSession();
  if (denied) return denied;
  const wallets = await db().select().from(schema.wallets).orderBy(asc(schema.wallets.createdAt));
  return NextResponse.json({ wallets });
}

export async function POST(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  const { address, label, provider } = await readJson<{ address?: string; label?: string; provider?: string }>(req);
  const prov = provider && isWalletBrand(provider) ? provider : "";
  const a = (address ?? "").trim();
  if (!isAddress(a) && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) return bad("Enter a valid EVM or Solana address");
  const [row] = await db()
    .insert(schema.wallets)
    .values({ address: a, label: (label ?? "").trim().slice(0, 60), provider: prov })
    .onConflictDoUpdate({ target: schema.wallets.address, set: { label: (label ?? "").trim().slice(0, 60), ...(prov ? { provider: prov } : {}) } })
    .returning();
  return NextResponse.json({ wallet: row }, { status: 201 });
}
