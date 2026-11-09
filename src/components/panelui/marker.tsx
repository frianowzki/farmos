"use client";
/**
 * Marker — status marker. PanelUI's Marker (native-only upstream) rebuilt for the web: a quiet dot + label
 * for a status, with a soft pulse for "live" states (respects reduced motion).
 */
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";

export function Marker({ tone = "gray", children, live, className }: { tone?: string; children: React.ReactNode; live?: boolean; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-2", className)}>
      <span className="relative inline-flex h-2 w-2">
        {live && !reduce && (
          <motion.span className={cn("absolute inset-0 rounded-full", `dot-${tone}`)} animate={{ scale: [1, 2.1], opacity: [0.45, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }} />
        )}
        <span className={cn("relative h-2 w-2 rounded-full", `dot-${tone}`)} />
      </span>
      {children}
    </span>
  );
}
