import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Auth.js error page. A failed *link* (X / Discord / GitHub / Google from Settings) must not look
 * like a logout: if the farmOS session is still valid, go back to Settings with the error.
 * Only a failed sign-in without a session lands on /login.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const error = url.searchParams.get("error") ?? "Default";
  const unlocked = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  const to = unlocked ? `/settings?connect_error=${encodeURIComponent(error)}#connections` : `/login?error=${encodeURIComponent(error)}`;
  return NextResponse.redirect(new URL(to, url.origin));
}
