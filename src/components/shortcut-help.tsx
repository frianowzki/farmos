"use client";
import { useEffect } from "react";
import { X } from "lucide-react";

const GROUPS: { title: string; rows: [string, string][] }[] = [
  {
    title: "Navigate",
    rows: [
      ["g then t", "Today"],
      ["g then p", "Projects"],
      ["g then k", "Daily tasks"],
      ["g then d", "Diary"],
      ["g then o", "Portfolio"],
      ["g then n", "Money"],
      ["g then m", "Upcoming mints"],
      ["g then l", "Watchlist"],
      ["g then w", "Wallets"],
      ["g then a", "Research desk"],
      ["g then c", "Feed"],
      ["g then r", "Recap"],
      ["g then s", "Settings"],
    ],
  },
  {
    title: "Act",
    rows: [
      ["n", "New project"],
      ["⌘K / Ctrl K", "Command palette"],
      ["/", "Search"],
      ["?", "This list"],
      ["Esc", "Close"],
    ],
  },
];

/** Keyboard reference. Rendered only while open, so it costs nothing on pages that never open it. */
export function ShortcutHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <div className="absolute inset-0 bg-bg/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[520px] overflow-hidden rounded-xl border border-line bg-panel shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-label text-[12px] font-medium uppercase tracking-[0.14em] text-muted">Keyboard</h2>
          <button onClick={onClose} className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-ink" aria-label="Close">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="grid gap-5 px-4 py-4 sm:grid-cols-2">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <h3 className="mb-2 text-[11.5px] font-medium text-ink">{g.title}</h3>
              <ul className="space-y-1.5">
                {g.rows.map(([k, label]) => (
                  <li key={k} className="flex items-center justify-between gap-3">
                    <span className="text-[12.5px] text-muted">{label}</span>
                    <kbd className="num shrink-0 rounded border border-line bg-bg px-1.5 py-0.5 text-[10.5px] text-ink-2">{k}</kbd>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
