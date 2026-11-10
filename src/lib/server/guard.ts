import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionProfileFromToken } from "@/lib/session";
import type { ProfileId } from "@/lib/profiles";

/** The signed-in profile for this request, or null. */
export async function currentProfile(): Promise<ProfileId | null> {
  const jar = await cookies();
  return sessionProfileFromToken(jar.get(SESSION_COOKIE)?.value).catch(() => null);
}

/**
 * Defense in depth: every API route re-checks the session even though proxy.ts gates too, and gets
 * the profile it must scope every query to. Usage:
 *   const s = await requireProfile(); if (s instanceof NextResponse) return s; const pid = s;
 */
export async function requireProfile(): Promise<ProfileId | NextResponse> {
  const pid = await currentProfile();
  return pid ?? NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

/** Session check only, for routes that touch no profile data (shared caches, avatars). */
export async function requireSession(): Promise<NextResponse | null> {
  return (await currentProfile()) ? null : NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function readJson<T = unknown>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}
