"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useSyncExternalStore } from "react";
import { ChromaticTextReveal } from "@/components/motion/chromatic-text-reveal";

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
  const weekday = now.toLocaleDateString("en-US", { weekday: "long" });
  const date = now.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const year = now.getFullYear();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const tz = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" }).formatToParts(now).find((p) => p.type === "timeZoneName")?.value ?? "";
  const dayPct = ((now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400) * 100;
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
              prefix={`${greeting(now.getHours())},`}
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
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="shrink-0 text-left sm:text-right">
          <div className="num flex items-baseline justify-start text-[30px] sm:justify-end font-medium leading-none tracking-[-0.02em] text-ink sm:text-[34px]" aria-label={`${hh}:${mm}`}>
            <Digit d={hh[0]} /><Digit d={hh[1]} />
            <motion.span animate={{ opacity: [1, 0.25, 1] }} transition={{ duration: 1, repeat: Infinity }} className="mx-[0.04em]">:</motion.span>
            <Digit d={mm[0]} /><Digit d={mm[1]} />
            <span className="ml-1.5 text-[0.5em] text-faint"><Digit d={ss[0]} /><Digit d={ss[1]} /></span>
            <span className="ml-2 text-[12px] font-normal tracking-normal text-muted">{tz}</span>
          </div>
          <div className="mt-2 flex items-center justify-start gap-2 text-[11.5px] text-muted sm:justify-end">
            <span>{Math.floor(dayPct)}% of the day</span>
            <span className="h-1 w-24 overflow-hidden rounded-full bg-hover">
              <motion.span className="block h-full rounded-full bg-accent" initial={{ width: 0 }} animate={{ width: `${dayPct}%` }} transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }} />
            </span>
          </div>
        </motion.div>
      </div>
      <p className="mt-3 text-[14px] text-muted">{line}</p>
    </div>
  );
}
