"use client";
/**
 * Questionnaire — PanelUI's Questionnaire (native-only upstream), rebuilt for the web with motion/react:
 * one question at a time, multiple answers allowed, progress, validation and a way back.
 */
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, Check } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui";

export type QOption = { id: string; label: string };
export type QQuestion = { id: string; title: string; help?: string; options: QOption[]; required?: boolean };

export function Questionnaire({ questions, initial = {}, onSubmit, submitLabel = "Finish", onCancel }: { questions: QQuestion[]; initial?: Record<string, string[]>; onSubmit: (answers: Record<string, string[]>) => void; submitLabel?: string; onCancel?: () => void }) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [answers, setAnswers] = useState<Record<string, string[]>>(initial);
  const [error, setError] = useState<string | null>(null);
  const reduce = useReducedMotion();
  const q = questions[step];
  const picked = answers[q.id] ?? [];
  const last = step === questions.length - 1;

  const toggle = (id: string) => {
    setError(null);
    setAnswers((a) => ({ ...a, [q.id]: picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id] }));
  };
  const next = () => {
    if (q.required && picked.length === 0) return setError("Pick at least one, or skip.");
    if (last) return onSubmit(answers);
    setDir(1);
    setStep((s) => s + 1);
  };
  const back = () => { setDir(-1); setError(null); setStep((s) => Math.max(0, s - 1)); };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-hover" role="progressbar" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={step + 1}>
          <motion.div className="h-full origin-left rounded-full bg-accent" animate={{ scaleX: (step + 1) / questions.length }} transition={{ type: "spring", stiffness: 260, damping: 32 }} />
        </div>
        <span className="num text-[12px] text-muted">{step + 1}/{questions.length}</span>
      </div>
      <div className="relative min-h-[244px] overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.fieldset
            key={q.id}
            custom={dir}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -28 }}
            transition={{ duration: 0.26, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <legend className="font-serif text-[22px] leading-tight text-ink">{q.title}</legend>
            {q.help && <p className="mt-1 text-[13px] text-muted">{q.help}</p>}
            <div className="mt-4 grid gap-1.5 sm:grid-cols-2">
              {q.options.map((o) => {
                const on = picked.includes(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(o.id)}
                    className={cn("flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-[13.5px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ring)]", on ? "border-accent bg-accent-soft text-ink" : "border-line bg-panel text-ink-2 hover:border-line-strong")}
                  >
                    <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors", on ? "border-accent bg-accent text-accent-ink" : "border-line-strong")}>
                      <AnimatePresence>{on && <motion.span initial={{ scale: 0.4 }} animate={{ scale: 1 }} exit={{ scale: 0.4, opacity: 0 }}><Check className="h-3 w-3" strokeWidth={3} /></motion.span>}</AnimatePresence>
                    </span>
                    {o.label}
                  </button>
                );
              })}
            </div>
          </motion.fieldset>
        </AnimatePresence>
      </div>
      {error && <p className="text-[12.5px] text-neg" role="alert">{error}</p>}
      <div className="flex items-center gap-2">
        {step > 0 ? <Button variant="ghost" onClick={back}><ArrowLeft className="h-3.5 w-3.5" /> Back</Button> : onCancel ? <Button variant="ghost" onClick={onCancel}>Cancel</Button> : null}
        <span className="flex-1" />
        {!last && !q.required && picked.length === 0 && <Button variant="ghost" onClick={next}>Skip</Button>}
        <Button variant="primary" onClick={next}>{last ? submitLabel : "Next"}</Button>
      </div>
    </div>
  );
}
