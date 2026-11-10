import { NextResponse } from "next/server";
import { readJson, requireSession } from "@/lib/server/guard";
import { getNotify, publicNotify, saveNotify } from "@/lib/server/telegram";

export async function GET() {
  const denied = await requireSession();
  if (denied) return denied;
  return NextResponse.json(publicNotify(await getNotify()));
}

/** Toggle digest sections, or unlink with { unlink: true }. */
export async function PATCH(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  const b = await readJson<Record<string, unknown>>(req);
  const patch: Record<string, unknown> = {};
  for (const k of ["enabled", "mints", "deadlines", "tasks", "streaks"]) if (typeof b[k] === "boolean") patch[k] = b[k];
  if (b.unlink === true) Object.assign(patch, { chatId: null, chatName: null, linkToken: null });
  return NextResponse.json(publicNotify(await saveNotify(patch)));
}
