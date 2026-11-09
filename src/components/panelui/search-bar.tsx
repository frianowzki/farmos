"use client";
/**
 * SearchBar — PanelUI's Search Bar (native-only upstream), web rebuild. Field + leading icon + clear
 * button + "/" shortcut hint; an optional scope row (rendered by the caller) sits beside it.
 */
import { AnimatePresence, motion } from "motion/react";
import { Search, X } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export const SearchBar = forwardRef<HTMLInputElement, { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; shortcut?: string }>(
  function SearchBar({ value, onChange, placeholder = "Search", className, shortcut = "/" }, ref) {
    return (
      <label className={cn("group relative flex h-8 min-w-0 items-center rounded-full border border-line bg-panel pl-8 pr-2 transition-[border-color,box-shadow] focus-within:border-line-strong focus-within:ring-2 focus-within:ring-[var(--ring)]", className)}>
        <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted" aria-hidden />
        <input
          ref={ref}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-full min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:hidden"
        />
        <AnimatePresence initial={false} mode="popLayout">
          {value ? (
            <motion.button key="x" type="button" aria-label="Clear search" onClick={() => onChange("")} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} className="rounded-full p-1 text-muted hover:bg-hover hover:text-ink">
              <X className="h-3 w-3" />
            </motion.button>
          ) : (
            <motion.kbd key="k" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="kbd hidden sm:inline-flex">{shortcut}</motion.kbd>
          )}
        </AnimatePresence>
      </label>
    );
  },
);
