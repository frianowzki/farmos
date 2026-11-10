import { NextResponse } from "next/server";
import { bad, readJson, requireProfile } from "@/lib/server/guard";
import { getProfileInfo, saveProfileInfo } from "@/lib/server/settings";
import { isTimeZone, TZ_COOKIE } from "@/lib/profiles";
import { isFiat, type Fiat } from "@/lib/fiat";
import { SESSION_TTL_SECONDS } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Readable (non-secret) mirror of the profile's zone so the client renders "today" correctly on first paint. */
const withTz = (res: NextResponse, tz: string) => {
  res.cookies.set(TZ_COOKIE, tz, { path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: SESSION_TTL_SECONDS });
  return res;
};

/** The signed-in profile, its display name (greetings) and time zone. */
export async function GET() {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const info = await getProfileInfo(pid);
  return withTz(NextResponse.json({ id: pid, ...info }), info.tz);
}

export async function PUT(req: Request) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const { name, tz, fiat } = await readJson<{ name?: string; tz?: string; fiat?: string }>(req);
  const patch: { name?: string; tz?: string; fiat?: Fiat } = {};
  if (fiat !== undefined) {
    if (!isFiat(fiat)) return bad("Unknown currency");
    patch.fiat = fiat;
  }
  if (name !== undefined) {
    const n = String(name).replace(/\s+/g, " ").trim();
    if (!n || n.length > 40) return bad("Name must be 1 to 40 characters");
    patch.name = n;
  }
  if (tz !== undefined) {
    if (!isTimeZone(tz)) return bad("Unknown time zone");
    patch.tz = tz;
  }
  await saveProfileInfo(pid, patch);
  const info = await getProfileInfo(pid);
  return withTz(NextResponse.json({ id: pid, ...info }), info.tz);
}
