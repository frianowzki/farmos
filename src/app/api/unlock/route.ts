import { createHash, timingSafeEqual as cryptoEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from "@/lib/session";

/** Fixed-length digests so the comparison is constant-time regardless of input length. */
const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();
const same = (a: Buffer, b: Buffer) => cryptoEqual(a, b);

const attempts = new Map<string, { n: number; t: number }>();

export async function POST(req: Request) {
  const expected = process.env.APP_PASSCODE?.trim();
  if (!expected) return NextResponse.json({ error: "APP_PASSCODE is not configured on the server." }, { status: 500 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const a = attempts.get(ip);
  const now = Date.now();
  if (a && now - a.t < 15 * 60_000 && a.n >= 8) {
    return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }
  const body = (await req.json().catch(() => ({}))) as { passcode?: string };
  const given = String(body.passcode ?? "");
  await new Promise((r) => setTimeout(r, 350));
  const g = digest(given);
  // The entered passcode picks the profile. Both are always compared (no early exit).
  const p2 = process.env.FARMOS_PROFILE2_PASSCODE?.trim();
  const isDefault = same(g, digest(expected));
  const isP2 = Boolean(p2) && p2 !== expected && same(g, digest(p2 ?? ""));
  if (!isDefault && !isP2) {
    attempts.set(ip, { n: (a && now - a.t < 15 * 60_000 ? a.n : 0) + 1, t: a && now - a.t < 15 * 60_000 ? a.t : now });
    return NextResponse.json({ error: "Wrong passcode." }, { status: 401 });
  }
  attempts.delete(ip);
  (await cookies()).set(SESSION_COOKIE, await createSessionToken(isDefault ? "passcode" : "profile:p2"), sessionCookieOptions);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  for (const c of jar.getAll()) if (c.name.includes("authjs")) jar.delete(c.name);
  return NextResponse.json({ ok: true });
}
