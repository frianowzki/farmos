import { NextResponse } from "next/server";
import { bad, requireProfile } from "@/lib/server/guard";
import { buildMonthlyReport, MONTH_RE, reportCsv } from "@/lib/server/report";
import { getProfileTz } from "@/lib/server/settings";
import { dayIn } from "@/lib/server/tz";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** GET /api/reports?month=YYYY-MM[&format=csv] → this profile's monthly report (JSON or CSV download). */
export async function GET(req: Request) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const u = new URL(req.url);
  const month = u.searchParams.get("month") || dayIn(new Date(), await getProfileTz(pid)).slice(0, 7);
  if (!MONTH_RE.test(month)) return bad("month must be YYYY-MM");
  const r = await buildMonthlyReport(pid, month);
  if (u.searchParams.get("format") === "csv") {
    return new Response("\uFEFF" + reportCsv(r), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="farmos-report-${month}.csv"`, "cache-control": "no-store" },
    });
  }
  return NextResponse.json(r, { headers: { "cache-control": "no-store" } });
}
