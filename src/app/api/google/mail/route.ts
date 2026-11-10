import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { classifyMail, matchMail } from "@/lib/mailmatch";
import { requireProfile } from "@/lib/server/guard";
import { GoogleError, listMail } from "@/lib/server/google";

export async function GET(req: Request) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days") ?? 21)));
  const extra = (url.searchParams.get("q") ?? "").slice(0, 200);
  try {
    const projects = await db()
      .select({ id: schema.projects.id, name: schema.projects.name, links: schema.projects.links, mailMatchers: schema.projects.mailMatchers })
      .from(schema.projects)
      .where(eq(schema.projects.profileId, pid));
    let q = `newer_than:${days}d -category:promotions ${extra}`.trim();
    if (projectId) {
      const p = projects.find((x) => x.id === projectId);
      if (!p) return NextResponse.json({ items: [] });
      const terms = [`"${p.name.replace(/"/g, "")}"`, ...p.mailMatchers.map((m) => (m.includes(".") && !m.includes(" ") ? `from:${m}` : `"${m.replace(/"/g, "")}"`))];
      q = `newer_than:90d (${terms.join(" OR ")})`;
    }
    const mail = await listMail(pid, q, projectId ? 25 : 40);
    const items = mail.map((m) => ({ ...m, signals: classifyMail(m), projectIds: matchMail(m, projects as never) }));
    return NextResponse.json({ items });
  } catch (e) {
    const status = e instanceof GoogleError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
