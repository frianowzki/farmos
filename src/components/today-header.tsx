"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useSyncExternalStore } from "react";
import { ChromaticTextReveal } from "@/components/motion/chromatic-text-reveal";
import { clockInZone } from "@/lib/dates";

const subscribe = (cb: () => void) => {
  const t = setInterval(cb, 1000);
  return () => clearInterval(t);
};
const nowSec = () => Math.floor(Date.now() / 1000);

function greeting(h: number) {
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** One digit that rolls up when it changes. */
function Digit({ d }: { d: string }) {
  const reduce = useReducedMotion();
  return (
    <span className="relative inline-flex h-[1.15em] w-[0.62em] justify-center overflow-hidden">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={d}
          initial={reduce ? { opacity: 0 } : { y: "100%", opacity: 0 }}
          animate={{ y: "0%", opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { y: "-100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="absolute"
        >
          {d}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Today's big, live date: animated weekday + date, rolling clock, and how much of the day is gone. */
export function TodayHeader({ name, line }: { name: string; line: React.ReactNode }) {
  const sec = useSyncExternalStore(subscribe, nowSec, () => 0);
  const now = sec ? new Date(sec * 1000) : null;
  if (!now) return <div className="mb-8 h-[148px]" />;
  // Clock, date and greeting follow the profile's zone, not the device's.
  const c = clockInZone(now);
  const weekday = c.weekday;
  const date = `${c.month} ${c.day}`;
  const year = c.year;
  const h12 = c.h % 12 || 12;
  const hh = String(h12).padStart(2, "0");
  const mm = String(c.m).padStart(2, "0");
  const ampm = c.h < 12 ? "AM" : "PM";
  const dayPct = ((c.h * 3600 + c.m * 60 + c.s) / 86400) * 100;
  const words = `${weekday}, ${date}`.split(" ");

  return (
    <div className="mb-8">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="font-wordmark text-[40px] font-semibold leading-[1.02] tracking-[-0.035em] text-ink [font-variation-settings:'opsz'_96] sm:text-[56px]" aria-label={`${weekday}, ${date} ${year}`}>
            {words.map((w, i) => (
              <motion.span
                key={`${w}-${i}`}
                initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ delay: 0.06 * i, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
                className={i === 0 ? "mr-[0.22em] inline-block text-accent" : "mr-[0.22em] inline-block"}
              >
                {w}
              </motion.span>
            ))}
          </h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="mt-2 font-serif text-[22px] leading-tight text-ink-2 sm:text-[26px]">
            <ChromaticTextReveal
              prefix={`${greeting(c.h)},`}
              words={[...(name ? [`${name}.`] : []), "stay early.", "farm smart.", "ship daily."]}
              colors={["#a3e635", "#34d399", "#22d3ee", "#818cf8", "#f472b6"]}
              foregroundColor="var(--ink-2)"
              duration={1.1}
              delay={0.35}
              pauseDuration={2.6}
              startOnView={false}
              className="italic"
            />
          </motion.p>
        </div>
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="inline-flex w-[148px] shrink-0 flex-col items-stretch sm:w-[164px]">
          <div className="num flex items-center justify-center gap-2 leading-none text-ink" aria-label={`${h12}:${mm} ${ampm}`}>
            <span className="flex items-baseline text-[34px] font-medium tracking-[-0.03em] sm:text-[38px]">
              <Digit d={hh[0]} /><Digit d={hh[1]} />
              <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="mx-[0.02em] -translate-y-[0.06em]">:</motion.span>
              <Digit d={mm[0]} /><Digit d={mm[1]} />
            </span>
            <span className="font-label text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{ampm}</span>
          </div>
          <span className="mt-2.5 h-[3px] w-full overflow-hidden rounded-full bg-hover">
            <motion.span className="block h-full rounded-full bg-accent" initial={{ width: 0 }} animate={{ width: `${dayPct}%` }} transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }} />
          </span>
          <span className="mt-1.5 text-center text-[11px] tracking-wide text-faint">{Math.floor(dayPct)}% of the day</span>
        </motion.div>
      </div>
      <p className="mt-3 text-[14px] text-muted">{line}</p>
    </div>
  );
}
