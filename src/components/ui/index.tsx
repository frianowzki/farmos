"use client";
import { Check, ChevronDown, X } from "lucide-react";
import { forwardRef, useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { Button as PanelButton } from "@/components/panelui/button";
import { Dialog as PanelDialog } from "@/components/panelui/dialog";

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "outline" | "danger" | "subtle"; size?: "sm" | "md" | "icon"; loading?: boolean };

const VARIANT = { primary: "default", outline: "outline", ghost: "ghost", subtle: "secondary", danger: "ghost" } as const;
const SIZE = { sm: "sm", md: "sm", icon: "icon-sm" } as const;

/** farmOS button: PanelUI Button (base-ui) tuned to the dense farmOS scale. */
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button({ variant = "outline", size = "md", className, ...p }, ref) {
  return (
    <PanelButton
      ref={ref}
      variant={VARIANT[variant]}
      size={SIZE[size]}
      {...p}
      className={cn(
        "gap-1.5 font-medium",
        size === "sm" && "h-7 rounded-md px-2.5 text-[12.5px]",
        size === "md" && "h-8 rounded-md px-3 text-[13px]",
        size === "icon" && "size-7 rounded-md",
        variant === "outline" && "border-line bg-panel text-ink shadow-none hover:not-disabled:bg-hover dark:bg-panel",
        variant === "ghost" && "text-ink-2 hover:not-disabled:bg-hover hover:not-disabled:text-ink",
        variant === "subtle" && "bg-hover text-ink hover:not-disabled:bg-active",
        variant === "danger" && "text-neg hover:not-disabled:bg-[var(--t-red-bg)] hover:not-disabled:text-neg",
        variant === "primary" && "inset-shadow-[0_1px_0_rgb(255_255_255/0.14)] hover:not-disabled:bg-primary/92",
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
    // Line-height stays at 1.35 (not 1) so descenders (g, y, p) are never clipped by the truncation box.
    <span className={cn("inline-flex min-h-[22px] max-w-full items-center gap-1.5 overflow-hidden rounded-[5px] px-1.5 py-px text-[12.5px] font-medium leading-[1.35]", `tone-${tone}`, className)}>
      {dot && <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", `dot-${tone}`)} />}
      <span className="min-w-0 truncate pt-px">{children}</span>
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
export function TagInput({ value, onChange, suggestions = [], placeholder = "Add…", tone = "gray", render, allowCreate = true }: { value: string[]; onChange: (v: string[]) => void; suggestions?: string[]; placeholder?: string; tone?: string; render?: (v: string) => ReactNode; allowCreate?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const add = (t: string) => {
    let v = t.trim();
    if (!allowCreate) v = suggestions.find((s) => s.toLowerCase() === v.toLowerCase()) ?? (filtered.length === 1 ? filtered[0] : "");
    if (!v || value.includes(v)) return;
    onChange([...value, v]);
    setQ("");
  };
  const filtered = suggestions.filter((s) => !value.includes(s) && s.toLowerCase().includes(q.toLowerCase())).slice(0, allowCreate ? 12 : 30);
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
            <span key={v} className={cn("inline-flex min-h-[22px] items-center gap-1 rounded-[5px] pl-1.5 pr-0.5 text-[12.5px] font-medium leading-[1.35]", `tone-${tone}`)}>
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
            placeholder={allowCreate ? "Type and press Enter" : "Search…"}
            className="min-w-[90px] flex-1 bg-transparent px-1 text-[13px] outline-none placeholder:text-faint"
          />
        </div>
        {filtered.map((s) => (
          <button key={s} type="button" onClick={() => add(s)} className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-hover">
            {render ? render(s) : s}
          </button>
        ))}
        {allowCreate && q && !suggestions.includes(q) && (
          <button type="button" onClick={() => add(q)} className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-hover">
            <span className="text-muted">Create</span> <Pill tone={tone}>{q}</Pill>
          </button>
        )}
      </Popover>
    </>
  );
}

/** Click-to-edit date with an always-visible clear button (touch screens have no reliable native "clear"). */
export function DateField({ value, onSave, className, placeholder = "Empty", align }: { value: string | null | undefined; onSave: (v: string | null) => void; className?: string; placeholder?: string; align?: "end" }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-0.5", align === "end" && "justify-end")}>
      <div className="min-w-0 flex-1"><InlineText type="date" value={value ?? ""} onSave={(v) => onSave(v || null)} placeholder={placeholder} mono className={className} /></div>
      {value ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onSave(null); }}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-faint hover:bg-hover hover:text-ink [@media(hover:hover)]:h-7 [@media(hover:hover)]:w-7"
          aria-label="Clear date"
          title="Clear date"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
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

/** Dialog built on PanelUI's Dialog (base-ui): focus trap, Escape, outside press, bottom sheet on phones. */
export function Dialog({ open, onClose, title, children, width = 520, bare, className }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; width?: number; bare?: boolean; className?: string }) {
  return (
    <PanelDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <PanelDialog.Content variant="plain" size={width > 560 ? "lg" : "md"} showClose={Boolean(title)} style={{ maxWidth: width }} className={cn("border-line bg-panel", className)}>
        {title && <PanelDialog.Header title={title} />}
        {bare ? children : <PanelDialog.Body>{children}</PanelDialog.Body>}
      </PanelDialog.Content>
    </PanelDialog>
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

/**
 * App-wide dropdown, same look as the Projects "Status" filter: a quiet trigger button and a
 * popover of pills with a check on the current one. (Kept the NativeSelect name so callers stay put.)
 */
export function NativeSelect({ value, onChange, options, className, icon, label, variant = "field", align = "start", width, ariaLabel }: { value: string; onChange: (v: string) => void; options: readonly { id: string; label: string; tone?: string; media?: ReactNode }[]; className?: string; icon?: ReactNode; label?: string; variant?: "field" | "ghost"; align?: "start" | "end"; width?: number; ariaLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [btn, setBtn] = useState<HTMLButtonElement | null>(null);
  const cur = options.find((o) => o.id === value);
  return (
    <div className={cn("relative", variant === "field" ? "" : "inline-flex", className)}>
      <button
        ref={setBtn}
        type="button"
        aria-label={ariaLabel ?? label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className={cn(
          "inline-flex h-8 min-w-0 items-center gap-1.5 rounded-md text-left text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
          variant === "field" ? "w-full border border-line bg-panel pl-1.5 pr-2 hover:bg-hover" : cn("px-2.5 text-ink-2 hover:bg-hover hover:text-ink", open && "bg-hover text-ink"),
        )}
      >
        {icon && <span className="shrink-0 text-muted [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>}
        {label && <span className="shrink-0 text-ink-2">{label}</span>}
        {label && cur && <span className="text-faint">·</span>}
        <span className="min-w-0 flex-1 truncate">
          {cur?.media ? <span className="flex min-w-0 items-center gap-1.5 px-0.5 text-ink">{cur.media}<span className="truncate">{cur.label}</span></span> : cur ? (variant === "field" ? <Pill tone={cur.tone ?? "gray"} dot={Boolean(cur.tone)}>{cur.label}</Pill> : <span className="text-ink">{cur.label}</span>) : <span className="px-1 text-faint">Select…</span>}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
      <Popover anchor={btn} open={open} onClose={() => setOpen(false)} align={align} width={width}>
        <div role="listbox">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              role="option"
              aria-selected={o.id === value}
              onClick={(e) => { e.stopPropagation(); onChange(o.id); setOpen(false); }}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-hover"
            >
              {o.media ? <span className="flex min-w-0 items-center gap-2 text-[13px] text-ink">{o.media}<span className="truncate">{o.label}</span></span> : <Pill tone={o.tone ?? "gray"} dot={Boolean(o.tone)}>{o.label}</Pill>}
              {o.id === value && <Check className="h-3.5 w-3.5 shrink-0 text-muted" />}
            </button>
          ))}
        </div>
      </Popover>
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
      <h2 className="font-label text-[11.5px] font-medium uppercase tracking-[0.14em] text-muted">{children}</h2>
      {right}
    </div>
  );
}
