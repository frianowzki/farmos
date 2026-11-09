"use client";
/**
 * Rating — PanelUI's Rating (native-only upstream), rebuilt for the web with motion/react.
 * A row of stars to read or set a score. Arrow keys move, Enter/Space or click sets, clicking the
 * current value clears it.
 */
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/cn";

const STAR = "M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.8l-5.4 2.9 1-6.1L3.2 9.3l6.1-.9z";

export function Rating({ value, onChange, size = 14, readOnly, className, label = "Rating" }: { value: number; onChange?: (v: number) => void; size?: number; readOnly?: boolean; className?: string; label?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const reduce = useReducedMotion();
  const shown = hover ?? value;
  if (readOnly || !onChange)
    return (
      <span role="img" aria-label={`${label}: ${value} of 5`} className={cn("inline-flex items-center gap-[2px]", className)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden className={i <= value ? "text-accent" : "text-line-strong"}>
            <path d={STAR} fill="currentColor" />
          </svg>
        ))}
      </span>
    );
  return (
    <span
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex items-center gap-[2px]", className)}
      onMouseLeave={() => setHover(null)}
      onClick={(e) => e.stopPropagation()}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <motion.button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} star${i > 1 ? "s" : ""}`}
          tabIndex={value === i || (value === 0 && i === 1) ? 0 : -1}
          onMouseEnter={() => setHover(i)}
          onFocus={() => setHover(i)}
          onBlur={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); onChange(Math.min(5, value + 1)); }
            if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); onChange(Math.max(0, value - 1)); }
          }}
          onClick={() => onChange(value === i ? 0 : i)}
          whileTap={reduce ? undefined : { scale: 0.82 }}
          animate={reduce ? undefined : { scale: hover === i ? 1.12 : 1 }}
          transition={{ type: "spring", stiffness: 520, damping: 22 }}
          className="rounded-[3px] p-[1px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className={cn("transition-colors duration-150", i <= shown ? "text-accent" : "text-line-strong")}>
            <path d={STAR} fill="currentColor" />
          </svg>
        </motion.button>
      ))}
    </span>
  );
}
