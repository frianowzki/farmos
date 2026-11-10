"use client";
import { Clock3, X } from "lucide-react";
import { useState } from "react";
import { Popover } from "@/components/ui";
import { cn } from "@/lib/cn";
import { time12 } from "@/lib/format";

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINS = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

/** 12-hour time picker. Value/onChange use "HH:mm" (24h) or null; shown as "9:30 PM". */
export function TimePicker({ value, onChange, className }: { value: string | null | undefined; onChange: (v: string | null) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const [btn, setBtn] = useState<HTMLButtonElement | null>(null);
  const m = value?.match(/^(\d{2}):(\d{2})$/);
  const h24 = m ? Number(m[1]) : 9;
  const min = m ? m[2] : "00";
  const pm = h24 >= 12;
  const h12 = h24 % 12 || 12;
  const emit = (h: number, mm: string, isPm: boolean) => onChange(`${String((h % 12) + (isPm ? 12 : 0)).padStart(2, "0")}:${mm}`);
  const cell = (on: boolean) => cn("num h-7 rounded-md text-[12.5px] transition-colors", on ? "bg-accent text-accent-ink" : "text-ink-2 hover:bg-hover");
  return (
    <>
      <button ref={setBtn} type="button" onClick={() => setOpen((o) => !o)} aria-label={value ? `Time ${time12(value)}` : "Add time"}
        className={cn("inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-1.5 text-[12.5px] transition-colors hover:bg-hover", value ? "num text-ink-2" : "text-faint hover:text-ink-2", className)}>
        <Clock3 className="h-3.5 w-3.5" /> {value ? time12(value) : "Time"}
      </button>
      <Popover anchor={btn} open={open} onClose={() => setOpen(false)} width={236}>
        <div className="space-y-2 p-1.5">
          <div className="flex rounded-md border border-line p-0.5 text-[12px]">
            {[false, true].map((isPm) => (
              <button key={String(isPm)} type="button" onClick={() => emit(h12, min, isPm)} className={cn("h-6 flex-1 rounded-[5px]", value && pm === isPm ? "bg-active text-ink" : "text-muted hover:text-ink")}>{isPm ? "PM" : "AM"}</button>
            ))}
          </div>
          <div>
            <div className="mb-1 font-label text-[10.5px] uppercase tracking-[0.12em] text-faint">Hour</div>
            <div className="grid grid-cols-6 gap-0.5">{HOURS.map((h) => <button key={h} type="button" onClick={() => emit(h, min, value ? pm : h < 12 && h >= 7 ? false : h === 12 ? true : false)} className={cell(Boolean(value) && h === h12)}>{h}</button>)}</div>
          </div>
          <div>
            <div className="mb-1 font-label text-[10.5px] uppercase tracking-[0.12em] text-faint">Minute</div>
            <div className="grid grid-cols-6 gap-0.5">{MINS.map((x) => <button key={x} type="button" onClick={() => emit(h12, x, pm)} className={cell(Boolean(value) && x === min)}>{x}</button>)}</div>
          </div>
          <div className="flex items-center justify-between border-t border-line pt-1.5">
            <span className="text-[11.5px] text-faint">Your time zone</span>
            {value && <button type="button" onClick={() => { onChange(null); setOpen(false); }} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[12px] text-muted hover:bg-hover hover:text-ink"><X className="h-3 w-3" /> Clear</button>}
          </div>
        </div>
      </Popover>
    </>
  );
}
