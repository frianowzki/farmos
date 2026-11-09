/**
 * Typography — PanelUI Typography (native-only upstream), web rebuild on the farmOS type system:
 * Display (EB Garamond), Eyebrow (Jost caps), Body (Google Sans), Num (Google Sans Code).
 */
import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/cn";

type P = { as?: ElementType; className?: string; children: ReactNode };
export const Display = ({ as: C = "h1", className, children }: P) => <C className={cn("font-serif text-[34px] font-normal leading-[1.08] tracking-[-0.015em] text-ink md:text-[40px]", className)}>{children}</C>;
export const Heading = ({ as: C = "h2", className, children }: P) => <C className={cn("font-serif text-[22px] font-normal leading-tight tracking-[-0.01em] text-ink", className)}>{children}</C>;
export const Eyebrow = ({ as: C = "div", className, children }: P) => <C className={cn("font-label text-[11px] font-medium uppercase tracking-[0.16em] text-muted", className)}>{children}</C>;
export const Body = ({ as: C = "p", className, children }: P) => <C className={cn("text-[14px] leading-relaxed text-ink-2", className)}>{children}</C>;
export const Num = ({ as: C = "span", className, children }: P) => <C className={cn("num tabular-nums", className)}>{children}</C>;
