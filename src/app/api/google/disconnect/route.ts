import { NextResponse } from "next/server";
import { requireSession } from "@/lib/server/guard";
import { disconnectGoogle } from "@/lib/server/google";

export async function POST() {
  const denied = await requireSession();
  if (denied) return denied;
  await disconnectGoogle();
  return NextResponse.json({ ok: true });
}
