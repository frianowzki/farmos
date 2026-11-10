import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

const PUBLIC = [/^\/login$/, /^\/auth-error$/, /^\/api\/unlock$/, /^\/api\/auth(\/|$)/, /^\/api\/health$/, /^\/api\/cron\//];

/**
 * One canonical domain keeps OAuth simple: every provider (Google, X, Discord, GitHub, Telegram) only needs
 * the APP_URL callbacks/domain. Old aliases redirect pages and /api/auth/* there; other API routes
 * (cron, health, JSON) are left alone so nothing machine-to-machine breaks.
 */
const ALIAS_HOSTS = (process.env.ALIAS_HOSTS ?? "frioos-iota.vercel.app").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
function canonicalRedirect(req: NextRequest) {
  const app = process.env.APP_URL;
  if (!app || (req.method !== "GET" && req.method !== "HEAD")) return null;
  let target: URL;
  try {
    target = new URL(app);
  } catch {
    return null;
  }
  const host = req.nextUrl.hostname.toLowerCase();
  if (host === target.hostname.toLowerCase() || !ALIAS_HOSTS.includes(host)) return null;
  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth")) return null;
  return NextResponse.redirect(new URL(pathname + search, target.origin), 308);
}

export async function proxy(req: NextRequest) {
  const moved = canonicalRedirect(req);
  if (moved) return moved;
  const { pathname, search } = req.nextUrl;
  if (PUBLIC.some((r) => r.test(pathname))) return NextResponse.next();
  const ok = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value).catch(() => false);
  if (ok) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|robots.txt|sw.js|offline.html|icons/).*)"],
};
