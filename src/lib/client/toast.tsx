"use client";
import { useSyncExternalStore, type ReactNode } from "react";
import { AnimatedToastStack, type AnimatedToast, type ToastStatus } from "@/components/motion/animated-toast-stack";

/**
 * App-wide toast store backed by beUI's Animated Toast Stack.
 * Same call shape the app already used: toast.success("Saved"), toast.error(msg), toast.loading(msg).
 */
let items: AnimatedToast[] = [];
const subs = new Set<() => void>();
const timers = new Map<string, number>();
const emit = () => subs.forEach((s) => s());
let n = 0;

function dismiss(id: string) {
  items = items.filter((t) => t.id !== id);
  const t = timers.get(id);
  if (t) window.clearTimeout(t);
  timers.delete(id);
  emit();
}

function schedule(id: string, duration: number) {
  const old = timers.get(id);
  if (old) window.clearTimeout(old);
  if (duration > 0) timers.set(id, window.setTimeout(() => dismiss(id), duration));
}

type Opts = { description?: ReactNode; id?: string; duration?: number; action?: AnimatedToast["action"] };

function show(status: ToastStatus, title: ReactNode, o: Opts = {}) {
  if (typeof window === "undefined") return "";
  const id = o.id ?? `t${++n}`;
  const duration = o.duration ?? (status === "loading" ? 0 : status === "error" ? 6000 : 3600);
  const next: AnimatedToast = { id, title, description: o.description, status, duration, action: o.action, dismissible: true, createdAt: Date.now() };
  items = items.some((t) => t.id === id) ? items.map((t) => (t.id === id ? next : t)) : [...items, next].slice(-5);
  schedule(id, duration);
  emit();
  return id;
}

type ToastFn = ((title: ReactNode, o?: Opts) => string) & {
  success: (title: ReactNode, o?: Opts) => string;
  error: (title: ReactNode, o?: Opts) => string;
  info: (title: ReactNode, o?: Opts) => string;
  loading: (title: ReactNode, o?: Opts) => string;
  dismiss: (id: string) => void;
  promise: <T>(p: Promise<T>, m: { loading: ReactNode; success: ReactNode | ((v: T) => ReactNode); error: ReactNode | ((e: unknown) => ReactNode) }) => Promise<T>;
};

export const toast = Object.assign((title: ReactNode, o?: Opts) => show("neutral", title, o), {
  success: (t: ReactNode, o?: Opts) => show("success", t, o),
  error: (t: ReactNode, o?: Opts) => show("error", t, o),
  info: (t: ReactNode, o?: Opts) => show("info", t, o),
  loading: (t: ReactNode, o?: Opts) => show("loading", t, o),
  dismiss,
  promise: async <T,>(p: Promise<T>, m: { loading: ReactNode; success: ReactNode | ((v: T) => ReactNode); error: ReactNode | ((e: unknown) => ReactNode) }) => {
    const id = show("loading", m.loading);
    try {
      const v = await p;
      show("success", typeof m.success === "function" ? (m.success as (v: T) => ReactNode)(v) : m.success, { id });
      return v;
    } catch (e) {
      show("error", typeof m.error === "function" ? (m.error as (e: unknown) => ReactNode)(e) : m.error, { id });
      throw e;
    }
  },
}) as ToastFn;

const EMPTY: AnimatedToast[] = [];
export function Toaster() {
  const list = useSyncExternalStore(
    (cb) => { subs.add(cb); return () => subs.delete(cb); },
    () => items,
    () => EMPTY,
  );
  return (
    <AnimatedToastStack
      toasts={list}
      onDismiss={dismiss}
      position="bottom-right"
      fixed
      maxVisible={4}
      className="bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 md:bottom-5 md:right-5"
      classNames={{ surface: "border-line bg-panel shadow-pop", title: "text-[13.5px] text-ink", description: "text-[12.5px] text-muted" }}
    />
  );
}
