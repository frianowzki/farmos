"use client";
/**
 * Countdown — PanelUI's Countdown (native-only upstream), rebuilt for the web.
 * The time left until a moment, ticking down to it; digits roll with motion/react.
 */
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

function Digit({ v }: { v: string }) {
  const reduce = useReducedMotion();
  return (
    <span className="relative inline-flex h-[1.15em] w-[0.62em] justify-center overflow-hidden">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span key={v} initial={reduce ? false : { y: "-70%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={reduce ? undefined : { y: "70%", opacity: 0 }} transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}>
          {v}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function Countdown({ to, className, compact, label }: { to: string | Date; className?: string; compact?: boolean; label?: string }) {
  const target = typeof to === "string" ? new Date(to.length === 10 ? `${to}T00:00:00` : to).getTime() : to.getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => { window.clearTimeout(first); window.clearInterval(id); };
  }, []);
  if (now === null) return <span className={cn("num text-muted", className)}>—</span>;
  const left = target - now;
  if (left <= 0) return <span className={cn("text-[12.5px] font-medium text-accent", className)}>{label ? `${label} · ` : ""}now</span>;
  const p = parts(left);
  if (compact)
    return (
      <span className={cn("num tabular-nums text-[12.5px] text-ink-2", className)} aria-label={`${p.d} days ${p.h} hours left`}>
        {p.d > 0 ? `${p.d}d ${p.h}h` : `${p.h}h ${String(p.m).padStart(2, "0")}m`}
      </span>
    );
  const units: [string, number][] = [["d", p.d], ["h", p.h], ["m", p.m], ["s", p.s]];
  return (
    <span className={cn("inline-flex items-baseline gap-2", className)} role="timer" aria-label={`${p.d} days ${p.h} hours ${p.m} minutes left`}>
      {units.map(([u, n]) => (
        <span key={u} className="inline-flex items-baseline">
          <span className="num text-[20px] font-medium leading-none tabular-nums text-ink">
            {String(n).padStart(2, "0").split("").map((c, i) => <Digit key={i} v={c} />)}
          </span>
          <span className="ml-0.5 font-label text-[10.5px] uppercase tracking-[0.12em] text-muted">{u}</span>
        </span>
      ))}
    </span>
  );
}
