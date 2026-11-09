"use client";
/**
 * EmptyState — PanelUI Empty State (native-only upstream), web rebuild. A drawn line-art mark,
 * a serif title, one sentence and at most two actions. The mark draws itself in once (motion/react).
 */
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const MARKS: Record<string, string[]> = {
  stack: ["M5 9l7-4 7 4-7 4z", "M5 13l7 4 7-4", "M5 17l7 4 7-4"],
  sun: ["M12 4v2", "M12 18v2", "M4 12h2", "M18 12h2", "M12 8a4 4 0 1 1 0 8a4 4 0 1 1 0-8z"],
  pen: ["M5 19l2.5-.6L18 7.9a1.6 1.6 0 0 0-2.3-2.3L5.6 16.1z", "M14 7l3 3"],
  wave: ["M3 14c2.5 0 2.5-4 5-4s2.5 4 5 4 2.5-4 5-4 2.5 4 3 4"],
  feed: ["M5 6h14", "M5 10h10", "M5 14h14", "M5 18h8"],
  clip: ["M15 7l-6.5 6.5a2.1 2.1 0 0 0 3 3L18 10a4 4 0 0 0-5.7-5.7L6 10.6a6 6 0 0 0 8.5 8.5L19 14.5"],
  link: ["M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1", "M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"],
  spark: ["M12 4l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"],
};

export function EmptyState({ mark = "stack", title, body, action, secondary, className, compact }: { mark?: keyof typeof MARKS | string; title: string; body?: ReactNode; action?: ReactNode; secondary?: ReactNode; className?: string; compact?: boolean }) {
  const reduce = useReducedMotion();
  const paths = MARKS[mark] ?? MARKS.stack;
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed border-line text-center", compact ? "px-5 py-8" : "px-6 py-14", className)}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="mb-4 text-accent" aria-hidden>
        {paths.map((d, i) => (
          <motion.path key={i} d={d} initial={reduce ? false : { pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 0.9, delay: 0.1 + i * 0.12, ease: [0.2, 0.8, 0.2, 1] }} />
        ))}
      </svg>
      <div className="font-serif text-[21px] leading-tight text-ink">{title}</div>
      {body && <div className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-muted">{body}</div>}
      {(action || secondary) && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{action}{secondary}</div>}
    </div>
  );
}
