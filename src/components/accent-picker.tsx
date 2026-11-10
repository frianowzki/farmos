"use client";
import { Check, Clock3, Palette, Shuffle } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { useProfile } from "@/lib/client/api";
import { playUi } from "@/lib/client/sound";
import { ACCENTS, applyAccent, dailyAccent, readAccent, saveAccent, timeAccent, type AccentPref } from "@/lib/accent";

/** Applies this profile's accent once the profile is known; keeps "time of day" fresh. */
export function AccentSync() {
  const { data } = useProfile();
  const pid = data?.id;
  useEffect(() => {
    if (!pid) return;
    const run = () => {
      const p = readAccent(pid);
      applyAccent(p);
      saveAccent(pid, p);
    };
    run();
    const t = setInterval(run, 5 * 60_000);
    const onStore = (e: StorageEvent) => e.key?.startsWith("farmos:accent") && run();
    window.addEventListener("storage", onStore);
    return () => { clearInterval(t); window.removeEventListener("storage", onStore); };
  }, [pid]);
  return null;
}

/** Settings → Appearance: curated accents plus dynamic and custom options. */
export function AccentPicker() {
  const { data } = useProfile();
  const pid = data?.id ?? "default";
  const [pref, setPref] = useState<AccentPref | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- read the stored choice after mount
  useEffect(() => setPref(readAccent(pid)), [pid]);
  const choose = (p: AccentPref) => {
    setPref(p);
    saveAccent(pid, p);
    applyAccent(p);
    playUi("toggle");
  };
  const cur = pref ?? { mode: "preset", id: "terracotta" };
  const hour = new Date().getHours();
  const custom = cur.custom ?? "#b8572b";

  return (
    <div className="max-w-md space-y-3">
      <div className="grid grid-cols-5 gap-2">
        {ACCENTS.map((a) => {
          const on = cur.mode === "preset" && (cur.id ?? "terracotta") === a.id;
          return (
            <button key={a.id} type="button" onClick={() => choose({ mode: "preset", id: a.id })} aria-pressed={on} title={a.label}
              className={cn("group flex flex-col items-center gap-1.5 rounded-lg border px-1 py-2 text-[11px] transition-colors", on ? "border-accent bg-accent-soft text-ink" : "border-line bg-panel text-muted hover:border-line-strong hover:text-ink")}>
              <Swatch light={a.light} dark={a.dark} on={on} />
              <span className="w-full truncate text-center">{a.label}</span>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Dyn on={cur.mode === "time"} onClick={() => choose({ mode: "time" })} icon={<Clock3 className="h-3.5 w-3.5" />} label="Time of day" sub={timeAccent(hour).label} />
        <Dyn on={cur.mode === "daily"} onClick={() => choose({ mode: "daily" })} icon={<Shuffle className="h-3.5 w-3.5" />} label="Daily shuffle" sub={dailyAccent().label} />
        <label className={cn("relative flex cursor-pointer flex-col items-start gap-1 rounded-lg border px-2.5 py-2 transition-colors", cur.mode === "custom" ? "border-accent bg-accent-soft" : "border-line bg-panel hover:border-line-strong")}>
          <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink"><Palette className="h-3.5 w-3.5 text-muted" /> Custom</span>
          <span className="num flex items-center gap-1.5 text-[11px] uppercase text-faint"><span className="h-2.5 w-2.5 rounded-full" style={{ background: custom }} />{custom}</span>
          <input type="color" value={custom} onChange={(e) => choose({ mode: "custom", custom: e.target.value })} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label="Custom accent colour" />
        </label>
      </div>
    </div>
  );
}

function Swatch({ light, dark, on }: { light: string; dark: string; on: boolean }) {
  return (
    <span className="relative flex h-6 w-6 items-center justify-center overflow-hidden rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]">
      <span className="absolute inset-0 dark:hidden" style={{ background: light }} />
      <span className="absolute inset-0 hidden dark:block" style={{ background: dark }} />
      {on && <Check className="relative h-3.5 w-3.5 text-white mix-blend-difference" strokeWidth={3} />}
    </span>
  );
}

function Dyn({ on, onClick, icon, label, sub }: { on: boolean; onClick: () => void; icon: React.ReactNode; label: string; sub: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={cn("flex flex-col items-start gap-1 rounded-lg border px-2.5 py-2 text-left transition-colors", on ? "border-accent bg-accent-soft" : "border-line bg-panel hover:border-line-strong")}>
      <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink"><span className="text-muted">{icon}</span> <span className="truncate">{label}</span></span>
      <span className="text-[11px] text-faint">Now: {sub}</span>
    </button>
  );
}
