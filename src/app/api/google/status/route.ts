import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/server/guard";
import { googleStatus } from "@/lib/server/google";

export async function GET() {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  return NextResponse.json(await googleStatus(pid));
}
