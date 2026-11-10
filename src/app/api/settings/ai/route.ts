import { NextResponse } from "next/server";
import { readJson, requireProfile } from "@/lib/server/guard";
import { getAiConfigPublic, saveAiConfig } from "@/lib/server/settings";

export async function GET() {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  return NextResponse.json(await getAiConfigPublic(pid));
}

export async function PUT(req: Request) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const b = await readJson<{ baseUrl?: string; model?: string; apiKey?: string | null; clearKey?: boolean; tools?: boolean }>(req);
  if (b.baseUrl && !/^https?:\/\//.test(b.baseUrl.trim())) return NextResponse.json({ error: "Base URL must start with http(s)://" }, { status: 400 });
  await saveAiConfig(pid, { baseUrl: b.baseUrl, model: b.model, apiKey: b.clearKey ? null : b.apiKey, tools: b.tools });
  return NextResponse.json(await getAiConfigPublic(pid));
}
