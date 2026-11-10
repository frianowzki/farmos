import { NextResponse } from "next/server";
import { bad, requireProfile } from "@/lib/server/guard";
import { restoreBackup, snapshotToBlob, summarize, validateBackup } from "@/lib/server/backup";

export const maxDuration = 60;

/**
 * POST a farmOS JSON backup. Without ?confirm=1 it only validates and returns row counts (dry run).
 * With ?confirm=1 it first snapshots current data to Blob (if available), then replaces everything.
 */
export async function POST(req: Request) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const text = await req.text();
  if (text.length > 4_000_000) return bad("Backup too large for upload (4 MB). Restore from a Blob snapshot instead.", 413);
  let b: unknown;
  try {
    b = JSON.parse(text);
  } catch {
    return bad("Not valid JSON");
  }
  if (!validateBackup(b)) return bad("This doesn't look like a farmOS backup");
  const counts = summarize(b);
  if (new URL(req.url).searchParams.get("confirm") !== "1") return NextResponse.json({ dryRun: true, exportedAt: b.exportedAt ?? null, counts });
  let safety: string | null = null;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      safety = (await snapshotToBlob(pid)).pathname;
    } catch {
      /* continue: user confirmed */
    }
  }
  try {
    await restoreBackup(pid, b);
  } catch (e) {
    return bad(`Restore failed, nothing changed: ${(e as Error).message.slice(0, 200)}`, 500);
  }
  return NextResponse.json({ restored: true, counts, safetySnapshot: safety });
}
