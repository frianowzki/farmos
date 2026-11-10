import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { bad, requireProfile } from "@/lib/server/guard";
import { KEEP, backupPrefix, listBackups, snapshotToBlob } from "@/lib/server/backup";

export const maxDuration = 60;

/** GET → list snapshots. GET ?download=<pathname> → stream one (private blob, gated). */
export async function GET(req: Request) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ configured: false, keep: KEEP, backups: [] });
  const dl = new URL(req.url).searchParams.get("download");
  if (dl) {
    const prefix = backupPrefix(pid);
    if (!dl.startsWith(prefix) || !/^farmos-\d{4}-\d{2}-\d{2}\.json$/.test(dl.slice(prefix.length))) return bad("not found", 404);
    const r = await get(dl, { access: "private" });
    if (!r || r.statusCode !== 200) return bad("not found", 404);
    return new Response(r.stream, { headers: { "content-type": "application/json", "content-disposition": `attachment; filename="${dl.slice(prefix.length)}"`, "cache-control": "no-store" } });
  }
  const list = await listBackups(pid);
  return NextResponse.json({ configured: true, keep: KEEP, backups: list.map((b) => ({ pathname: b.pathname, size: b.size, uploadedAt: b.uploadedAt })) });
}

/** Snapshot now. */
export async function POST() {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  try {
    const r = await snapshotToBlob(pid);
    return NextResponse.json({ ok: true, pathname: r.pathname, pruned: r.pruned });
  } catch (e) {
    return bad((e as Error).message, 502);
  }
}
