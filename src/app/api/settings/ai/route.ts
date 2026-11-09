import { NextResponse } from "next/server";
import { readJson, requireSession } from "@/lib/server/guard";
import { getAiConfigPublic, saveAiConfig } from "@/lib/server/settings";

export async function GET() {
  const denied = await requireSession();
  if (denied) return denied;
  return NextResponse.json(await getAiConfigPublic());
}

export async function PUT(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  const b = await readJson<{ baseUrl?: string; model?: string; apiKey?: string | null; clearKey?: boolean; tools?: boolean }>(req);
  if (b.baseUrl && !/^https?:\/\//.test(b.baseUrl.trim())) return NextResponse.json({ error: "Base URL must start with http(s)://" }, { status: 400 });
  await saveAiConfig({ baseUrl: b.baseUrl, model: b.model, apiKey: b.clearKey ? null : b.apiKey, tools: b.tools });
  return NextResponse.json(await getAiConfigPublic());
}
