import { bad, requireSession } from "@/lib/server/guard";
import { collectBackup, columnsOf, TABLE_NAMES, toCsv, type TableName } from "@/lib/server/backup";

/** GET /api/export → full JSON backup. GET /api/export?format=csv&table=projects → one table as CSV. */
export async function GET(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  const u = new URL(req.url);
  const day = new Date().toISOString().slice(0, 10);
  const b = await collectBackup();
  if (u.searchParams.get("format") === "csv") {
    const t = u.searchParams.get("table") as TableName | null;
    if (!t || !TABLE_NAMES.includes(t)) return bad(`table must be one of: ${TABLE_NAMES.join(", ")}`);
    return new Response(toCsv(b[t], columnsOf(t)), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="farmos-${t}-${day}.csv"`, "cache-control": "no-store" },
    });
  }
  return new Response(JSON.stringify(b, null, 2), {
    headers: { "content-type": "application/json", "content-disposition": `attachment; filename="farmos-backup-${day}.json"`, "cache-control": "no-store" },
  });
}
