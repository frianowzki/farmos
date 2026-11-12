"use client";
import { useMemo, useState, type ReactNode } from "react";
import { pie, arc as d3arc } from "d3-shape";
import { cn } from "@/lib/cn";

export type Slice = { id: string; label: string; value: number; color?: string; icon?: ReactNode };

const PALETTE = ["var(--pos)", "var(--accent)", "var(--warn)", "var(--neg)", "var(--ink-2)", "var(--faint)"];

/**
 * Donut breakdown of a portfolio dimension. SVG + d3-shape only — the app already ships d3-shape for
 * the PnL bars, so a chart library would be dead weight for one visualisation.
 */
export function DonutChart({ slices, unit, emptyLabel = "No data yet", size = 180 }: { slices: Slice[]; unit?: (n: number) => string; emptyLabel?: string; size?: number }) {
  const [hover, setHover] = useState<string | null>(null);
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);
  const live = slices.filter((s) => s.value > 0);

  const arcs = useMemo(() => {
    if (total <= 0) return [];
    const gen = pie<Slice>().value((d) => Math.max(0, d.value)).sort(null).padAngle(0.012);
    const shape = d3arc<{ startAngle: number; endAngle: number }>().innerRadius(52).outerRadius(86).cornerRadius(2);
    return gen(live).map((a, i) => ({
      id: a.data.id,
      label: a.data.label,
      value: a.data.value,
      icon: a.data.icon,
      d: shape(a as unknown as { startAngle: number; endAngle: number }) ?? "",
      color: a.data.color ?? PALETTE[i % PALETTE.length],
      pct: a.data.value / total,
    }));
  }, [live, total]);

  if (total <= 0) {
    return <div className="flex h-[190px] items-center justify-center text-[13px] text-muted">{emptyLabel}</div>;
  }

  const active = arcs.find((a) => a.id === hover) ?? null;
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-5">
      <svg viewBox="-100 -100 200 200" style={{ width: size, height: size }} className="shrink-0" role="img" aria-label="Breakdown">
        {arcs.map((a) => (
          <path
            key={a.id}
            d={a.d}
            fill={a.color}
            opacity={hover && hover !== a.id ? 0.35 : 1}
            className="cursor-pointer transition-opacity duration-150"
            onMouseEnter={() => setHover(a.id)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
        <text textAnchor="middle" y={active ? -8 : -4} className="fill-faint text-[10px]">{active ? active.label : "Total"}</text>
        <text textAnchor="middle" y={active ? 12 : 16} className="fill-ink text-[15px] font-medium">
          {active ? `${(active.pct * 100).toFixed(1)}%` : unit ? unit(total) : total}
        </text>
      </svg>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {arcs.map((a) => (
          <li
            key={a.id}
            className={cn("flex items-center gap-2 rounded px-1 py-0.5 text-[12.5px] transition-colors", hover === a.id && "bg-hover")}
            onMouseEnter={() => setHover(a.id)}
            onMouseLeave={() => setHover(null)}
          >
            {a.icon ?? <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: a.color }} />}
            <span className="min-w-0 flex-1 truncate text-ink-2">{a.label}</span>
            <span className="num shrink-0 text-faint">{unit ? unit(a.value) : `${(a.pct * 100).toFixed(1)}%`}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
