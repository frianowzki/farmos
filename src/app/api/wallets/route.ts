import { asc, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { bad, readJson, requireProfile } from "@/lib/server/guard";
import { isWalletBrand } from "@/lib/wallet-brands";
import { setDefaultWallet } from "@/lib/server/wallets";
import { familiesFor, normalizeAddress, walletFamily, type WalletFamily } from "@/lib/wallet-chains";

export async function GET() {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const wallets = await db().select().from(schema.wallets).where(eq(schema.wallets.profileId, pid)).orderBy(desc(schema.wallets.isDefault), asc(schema.wallets.createdAt));
  return NextResponse.json({ wallets });
}

export async function POST(req: Request) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const { address, label, provider, chain, isDefault } = await readJson<{ address?: string; label?: string; provider?: string; chain?: string; isDefault?: boolean }>(req);
  const prov = provider && isWalletBrand(provider) ? provider : "";
  const raw = (address ?? "").trim();
  const opts = familiesFor(raw);
  if (!opts.length) return bad("Enter a valid EVM, Solana, Aptos, Sui, NEAR, Canton party, Zcash or Monero address");
  if (chain && !opts.includes(chain as WalletFamily)) return bad(`That doesn't look like a ${chain} address`);
  const fam = walletFamily({ address: raw, chain, provider: prov });
  if (opts.length > 1 && !chain && !prov) return bad("Pick Aptos or Sui for this address");
  const a = normalizeAddress(raw, fam);
  const lbl = (label ?? "").trim().slice(0, 60);
  const [row] = await db()
    .insert(schema.wallets)
    .values({ address: a, label: lbl, provider: prov, chain: fam ?? "", profileId: pid })
    .onConflictDoUpdate({ target: [schema.wallets.profileId, schema.wallets.address], set: { label: lbl, chain: fam ?? "", ...(prov ? { provider: prov } : {}) } })
    .returning();
  if (isDefault === true) return NextResponse.json({ wallet: await setDefaultWallet(pid, row.id) }, { status: 201 });
  return NextResponse.json({ wallet: row }, { status: 201 });
}

