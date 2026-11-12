import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/server/guard";
import { getAiConfig } from "@/lib/server/settings";

export const dynamic = "force-dynamic";

type ModelRow = { id: string; owned_by?: string | null };

/**
 * Lists the models the configured endpoint actually serves, so settings and the research desk can
 * offer a picker instead of a free-text field the user has to guess at. OpenAI-compatible `/models`
 * is the only endpoint shape we can rely on across providers.
 */
export async function GET() {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;

  const cfg = await getAiConfig(pid);
  if (!cfg.baseUrl) return NextResponse.json({ models: [], error: "No base URL configured" }, { status: 412 });
  const key = cfg.apiKey;
  if (!key) return NextResponse.json({ models: [], error: "No AI key configured" }, { status: 412 });

  try {
    const r = await fetch(`${cfg.baseUrl.replace(/\/+$/, "")}/models`, {
      headers: { authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      return NextResponse.json({ models: [], error: `Endpoint returned ${r.status}${body ? `: ${body.slice(0, 120)}` : ""}` }, { status: 502 });
    }
    const j = (await r.json()) as { data?: ModelRow[]; models?: ModelRow[] };
    const models = (j.data ?? j.models ?? [])
      .map((m) => ({ id: m.id, ownedBy: m.owned_by ?? null }))
      .filter((m) => typeof m.id === "string" && m.id.length > 0)
      .sort((a, b) => a.id.localeCompare(b.id));
    return NextResponse.json({ models, current: cfg.model ?? null });
  } catch (e) {
    return NextResponse.json({ models: [], error: (e as Error).message }, { status: 502 });
  }
}
