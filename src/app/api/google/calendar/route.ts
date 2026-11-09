import { NextResponse } from "next/server";
import { requireSession } from "@/lib/server/guard";
import { GoogleError, upcomingEvents } from "@/lib/server/google";

export async function GET(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  const days = Math.min(60, Math.max(1, Number(new URL(req.url).searchParams.get("days") ?? 14)));
  try {
    return NextResponse.json({ events: await upcomingEvents(days) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: e instanceof GoogleError ? e.status : 500 });
  }
}
