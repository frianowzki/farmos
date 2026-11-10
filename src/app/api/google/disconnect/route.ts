import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/server/guard";
import { disconnectGoogle } from "@/lib/server/google";

export async function POST() {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  await disconnectGoogle(pid);
  return NextResponse.json({ ok: true });
}
