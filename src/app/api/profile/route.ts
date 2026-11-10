import { NextResponse } from "next/server";
import { bad, readJson, requireProfile } from "@/lib/server/guard";
import { getProfileName, setProfileName } from "@/lib/server/settings";

export const dynamic = "force-dynamic";

/** The signed-in profile and its display name (used in greetings). */
export async function GET() {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  return NextResponse.json({ id: pid, name: await getProfileName(pid) });
}

export async function PUT(req: Request) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const { name } = await readJson<{ name?: string }>(req);
  const n = String(name ?? "").replace(/\s+/g, " ").trim();
  if (!n || n.length > 40) return bad("Name must be 1 to 40 characters");
  await setProfileName(pid, n);
  return NextResponse.json({ id: pid, name: await getProfileName(pid) });
}
