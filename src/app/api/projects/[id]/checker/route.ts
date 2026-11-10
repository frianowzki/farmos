import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { db, schema } from "@/db";
import type { AirdropChecker } from "@/db/schema";
import { runChecker, validateChecker } from "@/lib/server/airdrop-check";
import { bad, readJson, requireProfile } from "@/lib/server/guard";

type Ctx = { params: Promise<{ id: string }> };
const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);
export const maxDuration = 60;

async function load(pid: string, id: string) {
  const [p] = await db().select().from(schema.projects).where(and(eq(schema.projects.profileId, pid), eq(schema.projects.id, id))).limit(1);
  return p;
}

/** Save (or clear with { checker: null }) the project's read-only checker config. */
export async function PUT(req: Request, ctx: Ctx) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const { id } = await ctx.params;
  if (!isUuid(id)) return bad("not found", 404);
  const { checker } = await readJson<{ checker?: Partial<AirdropChecker> | null }>(req);
  if (checker === null) {
    await db().update(schema.projects).set({ checker: null, updatedAt: new Date() }).where(and(eq(schema.projects.profileId, pid), eq(schema.projects.id, id)));
    return NextResponse.json({ checker: null });
  }
  const c = checker ?? {};
  const err = validateChecker(c);
  if (err) return bad(err);
  const clean: AirdropChecker = {
    type: c.type!,
    url: c.url?.trim() || undefined,
    path: c.path?.trim() || undefined,
    chain: c.chain?.trim() || undefined,
    address: c.address?.trim() || undefined,
    fn: c.fn?.trim() || undefined,
    decimals: typeof c.decimals === "number" && c.decimals >= 0 && c.decimals <= 36 ? c.decimals : undefined,
    claimUrl: c.claimUrl?.trim() && /^https:\/\//.test(c.claimUrl.trim()) ? c.claimUrl.trim() : undefined,
    lastRun: null,
  };
  const [row] = await db().update(schema.projects).set({ checker: clean, updatedAt: new Date() }).where(and(eq(schema.projects.profileId, pid), eq(schema.projects.id, id))).returning();
  if (!row) return bad("not found", 404);
  return NextResponse.json({ checker: row.checker });
}

/** Run the check for the project's wallets (or all linked EVM wallets if none are tagged). */
export async function POST(_: Request, ctx: Ctx) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const { id } = await ctx.params;
  if (!isUuid(id)) return bad("not found", 404);
  const p = await load(pid, id);
  if (!p) return bad("not found", 404);
  if (!p.checker) return bad("No checker configured", 412);
  let wallets = p.wallets.filter((w) => isAddress(w));
  if (!wallets.length) wallets = (await db().select().from(schema.wallets).where(eq(schema.wallets.profileId, pid))).map((w) => w.address).filter((a) => isAddress(a));
  if (!wallets.length) return bad("Link an EVM wallet first", 412);
  const results = await runChecker(p.checker, wallets);
  const checker: AirdropChecker = { ...p.checker, lastRun: { at: new Date().toISOString(), results } };
  // The checker's verdict also fills the project's Eligibility field (any wallet eligible wins).
  const ok = results.filter((r) => r.status !== "error");
  const eligibility = ok.some((r) => r.status === "eligible") ? "eligible" : ok.length && ok.length === results.length ? "not_eligible" : p.eligibility;
  await db().update(schema.projects).set({ checker, eligibility }).where(and(eq(schema.projects.profileId, pid), eq(schema.projects.id, id)));
  return NextResponse.json({ checker });
}
