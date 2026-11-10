import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { isConfigured, saveConnection, verifyTelegram } from "@/lib/server/connections";

export const dynamic = "force-dynamic";

/**
 * Login Widget redirect flow (data-auth-url): Telegram sends the signed user fields as query
 * params. Works where the popup → postMessage → JS callback path gets lost.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (q: string) => NextResponse.redirect(new URL(`/settings?${q}#connections`, url.origin));
  if (!(await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value))) return NextResponse.redirect(new URL("/login", url.origin));
  if (!isConfigured("telegram")) return back("connect_error=telegram_not_configured");
  const data: Record<string, string> = {};
  for (const k of ["id", "first_name", "last_name", "username", "photo_url", "auth_date", "hash"]) {
    const v = url.searchParams.get(k);
    if (v != null) data[k] = v;
  }
  if (!verifyTelegram(data)) return back("connect_error=telegram_signature");
  await saveConnection({
    provider: "telegram",
    providerAccountId: data.id,
    username: data.username ?? null,
    name: [data.first_name, data.last_name].filter(Boolean).join(" ") || null,
    image: data.photo_url ?? null,
  });
  return back("connected=telegram");
}
