import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

/** Defense in depth: every API route re-checks the session even though proxy.ts gates too. */
export async function requireSession(): Promise<NextResponse | null> {
  const jar = await cookies();
  const ok = await verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  return ok ? null : NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
