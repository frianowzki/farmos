import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions, timingSafeEqual } from "@/lib/session";

const attempts = new Map<string, { n: number; t: number }>();

export async function POST(req: Request) {
  const expected = process.env.APP_PASSCODE;
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
  if (!timingSafeEqual(given, expected)) {
    attempts.set(ip, { n: (a && now - a.t < 15 * 60_000 ? a.n : 0) + 1, t: a && now - a.t < 15 * 60_000 ? a.t : now });
    return NextResponse.json({ error: "Wrong passcode." }, { status: 401 });
  }
  attempts.delete(ip);
  (await cookies()).set(SESSION_COOKIE, await createSessionToken("passcode"), sessionCookieOptions);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  for (const c of jar.getAll()) if (c.name.includes("authjs")) jar.delete(c.name);
  return NextResponse.json({ ok: true });
}
