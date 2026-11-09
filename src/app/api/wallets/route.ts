import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { db, schema } from "@/db";
import { bad, readJson, requireSession } from "@/lib/server/guard";

export async function GET() {
  const denied = await requireSession();
  if (denied) return denied;
  const wallets = await db().select().from(schema.wallets).orderBy(asc(schema.wallets.createdAt));
  return NextResponse.json({ wallets });
}

export async function POST(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  const { address, label } = await readJson<{ address?: string; label?: string }>(req);
  const a = (address ?? "").trim();
  if (!isAddress(a) && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) return bad("Enter a valid EVM or Solana address");
  const [row] = await db()
    .insert(schema.wallets)
    .values({ address: a, label: (label ?? "").trim().slice(0, 60) })
    .onConflictDoUpdate({ target: schema.wallets.address, set: { label: (label ?? "").trim().slice(0, 60) } })
    .returning();
  return NextResponse.json({ wallet: row }, { status: 201 });
}
