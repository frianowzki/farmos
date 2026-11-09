"use client";
/**
 * Fab — PanelUI's floating action button (native-only upstream), rebuilt for the web with motion/react.
 * One action pinned over the content, with an optional dial of others behind it.
 */
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type FabAction = { id: string; label: string; icon: ReactNode; onSelect: () => void; shortcut?: string };

export function Fab({ actions, label = "Create", className }: { actions: FabAction[]; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div ref={root} className={cn("fixed z-[60] flex flex-col items-end gap-2", className)}>
      <AnimatePresence>
        {open && (
          <motion.ul
            role="menu"
            aria-label={label}
            className="flex flex-col items-end gap-1.5"
            initial="closed"
            animate="open"
            exit="closed"
            variants={{ open: { transition: { staggerChildren: 0.04, staggerDirection: -1 } }, closed: { transition: { staggerChildren: 0.03 } } }}
          >
            {actions.map((a) => (
              <motion.li
                key={a.id}
                role="none"
                variants={reduce ? undefined : { open: { opacity: 1, y: 0, scale: 1 }, closed: { opacity: 0, y: 8, scale: 0.96 } }}
                transition={{ type: "spring", stiffness: 520, damping: 34 }}
              >
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => { setOpen(false); a.onSelect(); }}
                  className="flex h-9 items-center gap-2.5 rounded-full border border-line bg-panel pl-3 pr-3.5 text-[13px] font-medium text-ink shadow-pop outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                >
                  <span className="text-muted [&_svg]:h-4 [&_svg]:w-4">{a.icon}</span>
                  {a.label}
                  {a.shortcut && <kbd className="kbd ml-1">{a.shortcut}</kbd>}
                </button>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
      <motion.button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        whileTap={reduce ? undefined : { scale: 0.92 }}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-ink shadow-pop outline-none inset-shadow-[0_1px_0_rgb(255_255_255/0.18)] focus-visible:ring-4 focus-visible:ring-[var(--ring)]"
      >
        <motion.span animate={{ rotate: open ? 45 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 30 }}>
          <Plus className="h-5 w-5" strokeWidth={2.2} />
        </motion.span>
      </motion.button>
    </div>
  );
}
