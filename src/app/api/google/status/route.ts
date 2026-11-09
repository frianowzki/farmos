import { NextResponse } from "next/server";
import { requireSession } from "@/lib/server/guard";
import { googleStatus } from "@/lib/server/google";

export async function GET() {
  const denied = await requireSession();
  if (denied) return denied;
  return NextResponse.json(await googleStatus());
}
