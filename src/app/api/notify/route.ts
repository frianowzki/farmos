import { NextResponse } from "next/server";
import { readJson, requireProfile } from "@/lib/server/guard";
import { getNotify, publicNotify, saveNotify } from "@/lib/server/telegram";

export async function GET() {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  return NextResponse.json(publicNotify(await getNotify(pid)));
}

/** Toggle digest sections, or unlink with { unlink: true }. */
export async function PATCH(req: Request) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const b = await readJson<Record<string, unknown>>(req);
  const patch: Record<string, unknown> = {};
  for (const k of ["enabled", "mints", "deadlines", "tasks", "streaks", "claims", "prices"]) if (typeof b[k] === "boolean") patch[k] = b[k];
  if (b.unlink === true) Object.assign(patch, { chatId: null, chatName: null, linkToken: null });
  return NextResponse.json(publicNotify(await saveNotify(pid, patch)));
}
