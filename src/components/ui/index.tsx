"use client";
import { Check, ChevronDown, X } from "lucide-react";
import { forwardRef, useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "outline" | "danger" | "subtle"; size?: "sm" | "md" | "icon" };

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button({ variant = "outline", size = "md", className, ...p }, ref) {
  return (
    <button
      ref={ref}
      {...p}
      className={cn(
        "inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-[background,color,border,box-shadow,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        size === "sm" && "h-7 px-2.5 text-[12.5px]",
        size === "md" && "h-8 px-3 text-[13px]",
        size === "icon" && "h-7 w-7 text-[13px]",
        variant === "primary" && "bg-accent text-accent-ink shadow-[inset_0_-1px_0_rgba(0,0,0,0.12)] hover:brightness-[1.06]",
        variant === "outline" && "border border-line bg-panel text-ink hover:bg-hover",
        variant === "ghost" && "text-ink-2 hover:bg-hover hover:text-ink",
        variant === "subtle" && "bg-hover text-ink hover:bg-active",
        variant === "danger" && "text-neg hover:bg-[var(--t-red-bg)]",
        className,
      )}
    />
  );
});

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return (
    <input
      ref={ref}
      {...p}
      className={cn(
        "h-8 w-full rounded-md border border-line bg-panel px-2.5 text-[13.5px] text-ink placeholder:text-faint transition-colors focus:border-line-strong focus:outline-none focus:ring-2 focus:ring-[var(--ring)]",
        className,
      )}
    />
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return (
    <textarea
      ref={ref}
      {...p}
      className={cn(
        "w-full rounded-md border border-line bg-panel px-2.5 py-2 text-[13.5px] text-ink placeholder:text-faint focus:border-line-strong focus:outline-none focus:ring-2 focus:ring-[var(--ring)]",
        className,
      )}
    />
  );
});

export function Pill({ tone = "gray", children, className, dot }: { tone?: string; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex h-[22px] max-w-full items-center gap-1.5 truncate rounded-[5px] px-1.5 text-[12.5px] font-medium leading-none", `tone-${tone}`, className)}>
      {dot && <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", `dot-${tone}`)} />}
      <span className="truncate">{children}</span>
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

/** Positioned popover rendered in a portal; closes on outside click / Escape. */
export function Popover({ anchor, open, onClose, children, align = "start", width }: { anchor: HTMLElement | null; open: boolean; onClose: () => void; children: ReactNode; align?: "start" | "end"; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    if (!open || !anchor) return;
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const w = width ?? Math.max(220, r.width);
      let left = align === "end" ? r.right - w : r.left;
      left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
      let top = r.bottom + 4;
      const h = ref.current?.offsetHeight ?? 260;
      if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 4);
      setPos({ top, left });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchor, align, width]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node) || anchor?.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchor]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={ref}
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: width ?? Math.max(220, anchor?.getBoundingClientRect().width ?? 220) }}
      className="anim-pop fixed z-[80] max-h-[340px] overflow-auto rounded-lg border border-line bg-panel p-1 shadow-pop"
    >
      {children}
    </div>,
    document.body,
  );
}

export type Opt = { id: string; label: string; tone?: string };

/** Notion-style single select shown as a pill. */
export function SelectPill({ value, options, onChange, placeholder = "Empty", className, dot = true }: { value: string | null | undefined; options: readonly Opt[]; onChange: (v: string) => void; placeholder?: string; className?: string; dot?: boolean }) {
  const [open, setOpen] = useState(false);
  const [btn, setBtn] = useState<HTMLButtonElement | null>(null);
  const cur = options.find((o) => o.id === value);
  return (
    <>
      <button ref={setBtn} type="button" onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }} className={cn("group inline-flex max-w-full items-center gap-1 rounded-md px-1 py-0.5 text-left hover:bg-hover", className)}>
        {cur ? <Pill tone={cur.tone ?? "gray"} dot={dot && Boolean(cur.tone)}>{cur.label}</Pill> : <span className="px-1 text-[13px] text-faint">{placeholder}</span>}
      </button>
      <Popover anchor={btn} open={open} onClose={() => setOpen(false)} width={220}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(o.id); setOpen(false); }}
            className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-hover"
          >
            <Pill tone={o.tone ?? "gray"} dot={dot && Boolean(o.tone)}>{o.label}</Pill>
            {o.id === value && <Check className="h-3.5 w-3.5 text-muted" />}
          </button>
        ))}
      </Popover>
    </>
  );
}

/** Multi-value tag input (chains, tags, wallets) with suggestions. */
export function TagInput({ value, onChange, suggestions = [], placeholder = "Add…", tone = "gray", render }: { value: string[]; onChange: (v: string[]) => void; suggestions?: string[]; placeholder?: string; tone?: string; render?: (v: string) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const add = (t: string) => {
    const v = t.trim();
    if (!v || value.includes(v)) return;
    onChange([...value, v]);
    setQ("");
  };
  const filtered = suggestions.filter((s) => !value.includes(s) && s.toLowerCase().includes(q.toLowerCase())).slice(0, 12);
  return (
    <>
      <div ref={setBox} onClick={(e) => { e.stopPropagation(); setOpen(true); setTimeout(() => input.current?.focus(), 0); }} className="flex min-h-[28px] w-full cursor-text flex-wrap items-center gap-1 rounded-md px-1 py-0.5 hover:bg-hover">
        {value.length === 0 && <span className="px-1 text-[13px] text-faint">{placeholder}</span>}
        {value.map((v) => (
          <Pill key={v} tone={tone}>{render ? render(v) : v}</Pill>
        ))}
      </div>
      <Popover anchor={box} open={open} onClose={() => setOpen(false)} width={280}>
        <div className="flex flex-wrap gap-1 border-b border-line p-1.5">
          {value.map((v) => (
            <span key={v} className={cn("inline-flex h-[22px] items-center gap-1 rounded-[5px] pl-1.5 pr-0.5 text-[12.5px] font-medium", `tone-${tone}`)}>
              {render ? render(v) : v}
              <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))} className="rounded p-0.5 opacity-60 hover:opacity-100">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(q); }
              if (e.key === "Backspace" && !q && value.length) onChange(value.slice(0, -1));
            }}
            placeholder="Type and press Enter"
            className="min-w-[90px] flex-1 bg-transparent px-1 text-[13px] outline-none placeholder:text-faint"
          />
        </div>
        {filtered.map((s) => (
          <button key={s} type="button" onClick={() => add(s)} className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-hover">
            {render ? render(s) : s}
          </button>
        ))}
        {q && !suggestions.includes(q) && (
          <button type="button" onClick={() => add(q)} className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-hover">
            <span className="text-muted">Create</span> <Pill tone={tone}>{q}</Pill>
          </button>
        )}
      </Popover>
    </>
  );
}

/** Click-to-edit text cell. */
export function InlineText({ value, onSave, placeholder = "Empty", className, inputClassName, type = "text", mono }: { value: string | number | null | undefined; onSave: (v: string) => void; placeholder?: string; className?: string; inputClassName?: string; type?: string; mono?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState("");
  const str = value == null ? "" : String(value);
  if (editing)
    return (
      <input
        autoFocus
        type={type}
        value={v}
        step="any"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { setEditing(false); if (v !== str) onSave(v); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") { setV(str); setEditing(false); }
        }}
        className={cn("h-7 w-full rounded-md border border-line-strong bg-panel px-1.5 text-[13.5px] outline-none ring-2 ring-[var(--ring)]", mono && "num", inputClassName)}
      />
    );
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); setV(str); setEditing(true); }} className={cn("flex min-h-[28px] w-full items-center truncate rounded-md px-1.5 text-left text-[13.5px] hover:bg-hover", mono && "num", className)}>
      {value === null || value === undefined || value === "" ? <span className="text-faint">{placeholder}</span> : String(value)}
    </button>
  );
}

export function Dialog({ open, onClose, title, children, width = 520 }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="anim-fade fixed inset-0 z-[70] flex items-start justify-center bg-black/25 px-3 pt-[12vh] backdrop-blur-[1px] dark:bg-black/50" onMouseDown={onClose}>
      <div style={{ maxWidth: width }} className="anim-pop w-full rounded-xl border border-line bg-panel shadow-pop" onMouseDown={(e) => e.stopPropagation()}>
        {title && (
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="text-[14px] font-semibold">{title}</div>
            <button type="button" onClick={onClose} className="rounded-md p-1 text-muted hover:bg-hover" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="p-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-faint">{hint}</span>}
    </label>
  );
}

export function NativeSelect({ value, onChange, options, className }: { value: string; onChange: (v: string) => void; options: readonly { id: string; label: string }[]; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-full appearance-none rounded-md border border-line bg-panel pl-2.5 pr-7 text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-[var(--ring)]">
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
    </div>
  );
}

export function Empty({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line px-6 py-12 text-center">
      {icon && <div className="mb-3 text-faint">{icon}</div>}
      <div className="font-serif text-[20px] leading-tight text-ink">{title}</div>
      {body && <div className="mt-1.5 max-w-sm text-[13.5px] text-muted">{body}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-hover", className)} />;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">{children}</h2>
      {right}
    </div>
  );
}
