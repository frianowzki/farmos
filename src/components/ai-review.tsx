"use client";
import { Check, CircleHelp, ExternalLink, RotateCcw, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { AiReview } from "@/db/schema";
import { Loader } from "@/components/motion/loader";
import { Rating } from "@/components/panelui/rating";
import { Button, Pill } from "@/components/ui";
import { api, useAiConfig } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/client/toast";

const VERDICT_TONE: Record<string, string> = { FARM: "green", "FARM SMALL": "blue", WATCH: "amber", AVOID: "red" };
const STEPS = ["Reading the project", "Checking official links", "Looking up DefiLlama", "Checking contracts", "Weighing the evidence"];

/** Runs the AI review for a project and shows the suggestion; the parent decides what to apply. */
export function AiReviewPanel({
  projectId,
  saved,
  onAcceptRating,
  onUseAnswers,
}: {
  projectId: string;
  saved?: AiReview | null;
  onAcceptRating: (r: AiReview, withTierRisk: boolean) => void;
  onUseAnswers?: (r: AiReview) => void;
}) {
  const ai = useAiConfig();
  const [review, setReview] = useState<AiReview | null>(saved ?? null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 4500);
    return () => clearInterval(t);
  }, [busy]);

  const run = async () => {
    setBusy(true);
    setStep(0);
    try {
      const r = await api<{ review: AiReview }>(`/api/projects/${projectId}/ai-review`, { method: "POST", body: {} });
      setReview(r.review);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (ai.data && !ai.data.configured)
    return (
      <div className="rounded-xl border border-dashed border-line px-4 py-3 text-[13px] text-muted">
        <Sparkles className="mr-1.5 inline h-3.5 w-3.5" /> AI review needs your model. <Link href="/settings#ai" className="text-accent underline underline-offset-2">Set up AI</Link>
      </div>
    );

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-[color-mix(in_oklab,var(--accent-soft)_35%,var(--panel))]">
      <div className="flex items-center gap-2 px-4 pb-2 pt-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-accent-ink"><Sparkles className="h-3.5 w-3.5" /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-medium text-ink">AI review</div>
          <div className="text-[11.5px] text-muted">{review ? `Suggested ${new Date(review.at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}${review.model ? ` · ${review.model}` : ""}` : "Your research desk checks the sources and suggests a rating"}</div>
        </div>
        {!busy && (
          <Button size="sm" variant={review ? "ghost" : "primary"} onClick={run}>
            {review ? <><RotateCcw className="h-3.5 w-3.5" /> Re-run</> : <><Sparkles className="h-3.5 w-3.5" /> Review with AI</>}
          </Button>
        )}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {busy ? (
          <motion.div key="busy" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="px-4 pb-4">
            <div className="flex items-center gap-2 text-[13px] text-ink-2">
              <Loader size={13} />
              <AnimatePresence mode="wait">
                <motion.span key={step} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>{STEPS[step]}…</motion.span>
              </AnimatePresence>
            </div>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-hover">
              <motion.div className="h-full rounded-full bg-accent" initial={{ width: "6%" }} animate={{ width: `${Math.round(((step + 1) / STEPS.length) * 90)}%` }} transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }} />
            </div>
          </motion.div>
        ) : review ? (
          <motion.div key="r" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3 px-4 pb-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <Rating value={review.rating} readOnly size={16} label="Suggested rating" />
              <span className="num text-[12.5px] text-muted">{review.score}/100</span>
              {review.verdict && <Pill tone={VERDICT_TONE[review.verdict] ?? "gray"}>{review.verdict}</Pill>}
              {review.tier && <Pill tone="stone">Tier {review.tier}</Pill>}
              {review.risk && <Pill tone={review.risk === "low" ? "green" : review.risk === "medium" ? "amber" : "red"} dot>{review.risk} risk</Pill>}
            </div>
            {review.summary && <p className="text-[13.5px] leading-relaxed text-ink-2">{review.summary}</p>}
            {review.reasons.length > 0 && (
              <ul className="space-y-1.5">
                {review.reasons.map((r, i) => (
                  <motion.li key={i} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="flex gap-2 text-[13px] leading-snug text-ink-2">
                    <span className={cn("mt-[2px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full", r.kind === "pro" ? "tone-green" : r.kind === "con" ? "tone-red" : "tone-gray")}>
                      {r.kind === "pro" ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : r.kind === "con" ? <X className="h-2.5 w-2.5" strokeWidth={3} /> : <CircleHelp className="h-2.5 w-2.5" strokeWidth={2.5} />}
                    </span>
                    <span>{r.text}</span>
                  </motion.li>
                ))}
              </ul>
            )}
            {review.sources.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {review.sources.map((s) => (
                  <a key={s.url} href={s.url} target="_blank" rel="noreferrer noopener" className="inline-flex h-6 max-w-[220px] items-center gap-1 rounded-md border border-line bg-panel px-2 text-[11.5px] leading-[1.35] text-ink-2 hover:border-line-strong hover:text-ink">
                    <span className="truncate">{s.title}</span> <ExternalLink className="h-3 w-3 shrink-0 text-faint" />
                  </a>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <Button size="sm" variant="primary" onClick={() => onAcceptRating(review, false)}><Check className="h-3.5 w-3.5" /> Accept {review.rating}★</Button>
              {(review.tier || review.risk) && <Button size="sm" onClick={() => onAcceptRating(review, true)}>Accept with tier &amp; risk</Button>}
              {onUseAnswers && Object.keys(review.answers).length > 0 && <Button size="sm" variant="ghost" onClick={() => onUseAnswers(review)}>Use answers in audit</Button>}
              <span className="ml-auto text-[11px] text-faint">Suggestion only. Verify before you farm.</span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
