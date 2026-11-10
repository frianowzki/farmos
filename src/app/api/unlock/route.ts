import { createHash, timingSafeEqual as cryptoEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from "@/lib/session";
import { PROFILE_IDS, PROFILE_PASSCODE_ENV, TZ_COOKIE, type ProfileId } from "@/lib/profiles";
import { getProfileTz } from "@/lib/server/settings";

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
  // The entered passcode picks the profile. Every profile is compared (no early exit), and a
  // passcode that equals another profile's is ignored so two profiles can never share one.
  const codes = PROFILE_IDS.map((id) => (id === "default" ? expected : process.env[PROFILE_PASSCODE_ENV[id]]?.trim() ?? ""));
  let match: ProfileId | null = null;
  PROFILE_IDS.forEach((id, i) => {
    const code = codes[i];
    const unique = Boolean(code) && codes.filter((c) => c === code).length === 1;
    const hit = same(g, digest(code || "\u0000unset"));
    if (unique && hit && !match) match = id;
  });
  const pid = match as ProfileId | null;
  if (!pid) {
    attempts.set(ip, { n: (a && now - a.t < 15 * 60_000 ? a.n : 0) + 1, t: a && now - a.t < 15 * 60_000 ? a.t : now });
    return NextResponse.json({ error: "Wrong passcode." }, { status: 401 });
  }
  attempts.delete(ip);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await createSessionToken(pid === "default" ? "passcode" : `profile:${pid}`), sessionCookieOptions);
  // Non-secret mirror of the profile's zone so the first render already uses it.
  const tz = await getProfileTz(pid).catch(() => null);
  if (tz) jar.set(TZ_COOKIE, tz, { ...sessionCookieOptions, httpOnly: false });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(TZ_COOKIE);
  for (const c of jar.getAll()) if (c.name.includes("authjs")) jar.delete(c.name);
  return NextResponse.json({ ok: true });
}
