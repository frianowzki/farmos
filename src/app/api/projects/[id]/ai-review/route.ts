import { NextResponse } from "next/server";
import { generateText, isStepCount } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import type { AiReview } from "@/db/schema";
import { AUDIT, auditScore, scoreToRating } from "@/lib/audit";
import { aiModel, aiToolsEnabled, buildTools, systemFor } from "@/lib/server/ai";
import { bad, requireProfile } from "@/lib/server/guard";
import { extractJson } from "@/lib/server/json-out";
import { getAiConfig } from "@/lib/server/settings";

export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

const Out = z.object({
  answers: z.record(z.string(), z.array(z.string())).catch({}),
  rating: z.coerce.number().int().min(1).max(5).optional().catch(undefined),
  tier: z.enum(["S", "A", "B", "C"]).nullable().optional().catch(null),
  risk: z.enum(["low", "medium", "high", "extreme"]).nullable().optional().catch(null),
  verdict: z.string().max(40).catch("WATCH"),
  summary: z.string().max(1200).catch(""),
  reasons: z.array(z.object({ kind: z.enum(["pro", "con", "unknown"]).catch("unknown"), text: z.string().max(400) })).max(12).catch([]),
  sources: z.array(z.object({ title: z.string().max(160).catch("Source"), url: z.string().url() })).max(10).catch([]),
});

const QUESTIONS = AUDIT.map((q) => ({ id: q.id, question: q.title, options: q.options.map((o) => ({ id: o.id, label: o.label })) }));

const INSTRUCTIONS = `Review this farmOS project and suggest how the user should rate it.
1) Use your tools to check what matters: official links (site, X, docs), DefiLlama (TVL, raises), contract checks if an address is known. Prefer primary sources.
2) Answer the audit questionnaire below. For each question pick ONLY the option ids that you have evidence for. Leave a question empty ([]) if unknown. Never guess.
3) Suggest a star rating 1–5 (5 = must farm), a tier (S/A/B/C) and a risk level (low/medium/high/extreme).
Questionnaire (JSON): ${JSON.stringify(QUESTIONS)}
Reply with ONLY one JSON object, no prose, no code fences:
{"answers":{"team":["doxxed"],...},"rating":4,"tier":"A","risk":"medium","verdict":"FARM"|"FARM SMALL"|"WATCH"|"AVOID","summary":"2-3 sentences","reasons":[{"kind":"pro"|"con"|"unknown","text":"…"}],"sources":[{"title":"DefiLlama","url":"https://…"}]}
Reasons: 3–7 short bullets with numbers/dates where you have them. Sources: only URLs a tool returned or the project's own links.`;

/** AI-suggested audit answers + rating with reasoning. Nothing is saved: the user accepts it in the UI. */
export async function POST(_: Request, ctx: Ctx) {
  const pid = await requireProfile();
  if (pid instanceof NextResponse) return pid;
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return bad("invalid id");
  const [p] = await db().select().from(schema.projects).where(and(eq(schema.projects.profileId, pid), eq(schema.projects.id, id))).limit(1);
  if (!p) return bad("not found", 404);
  let model;
  try {
    model = await aiModel(pid);
  } catch (e) {
    return bad((e as Error).message, 412);
  }
  const { notes, audit, ...rest } = p;
  const context = JSON.stringify({ ...rest, currentAudit: audit ? { answers: audit.answers, score: audit.score } : null, notes: notes.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 3000) });
  const useTools = await aiToolsEnabled(pid);
  let text = "";
  try {
    const r = await generateText({
      model,
      system: systemFor("audit", context),
      prompt: INSTRUCTIONS,
      ...(useTools ? { tools: buildTools(pid), stopWhen: isStepCount(8) } : {}),
    });
    text = r.text;
  } catch (e) {
    return bad(`The model call failed: ${(e as Error).message.slice(0, 200)}`, 502);
  }
  const parsed = Out.safeParse(extractJson(text, "object") ?? {});
  if (!parsed.success) return bad("The model didn't return a usable review. Try again.", 502);
  const o = parsed.data;
  // Keep only option ids that exist in the questionnaire.
  const answers: Record<string, string[]> = {};
  for (const q of AUDIT) {
    const ids = (o.answers[q.id] ?? []).filter((x) => q.options.some((opt) => opt.id === x));
    if (ids.length) answers[q.id] = [...new Set(ids)];
  }
  const score = auditScore(answers);
  const cfg = await getAiConfig(pid);
  const review: AiReview = {
    rating: o.rating ?? scoreToRating(score),
    score,
    tier: o.tier ?? null,
    risk: o.risk ?? null,
    verdict: o.verdict.toUpperCase().slice(0, 40),
    summary: o.summary,
    reasons: o.reasons.filter((r) => r.text.trim()),
    sources: o.sources,
    answers,
    model: cfg.model,
    at: new Date().toISOString(),
  };
  return NextResponse.json({ review });
}
