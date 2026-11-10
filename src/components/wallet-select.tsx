"use client";
import { useEffect, useRef } from "react";
import { useWallets } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import { shortAddr } from "@/lib/format";

/** The profile's default wallet (or null). Wallets come back default-first from the API. */
export function useDefaultWallet() {
  const { data } = useWallets();
  return data?.wallets.find((w) => w.isDefault) ?? null;
}

/**
 * Pick one of the profile's saved wallets. The default wallet is preselected once wallets load
 * (unless `preselect` is false or the value was already set), and marked with a star.
 */
export function WalletSelect({ value, onChange, className, preselect = true, allowNone = true }: { value: string; onChange: (v: string) => void; className?: string; preselect?: boolean; allowNone?: boolean }) {
  const { data } = useWallets();
  const wallets = data?.wallets ?? [];
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !data) return;
    done.current = true;
    const d = data.wallets.find((w) => w.isDefault);
    if (preselect && d && !value) onChange(d.address);
  }, [data, preselect, value, onChange]);
  const known = !value || wallets.some((w) => w.address === value);
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Wallet" className={cn("min-w-0 rounded-md border border-line bg-bg px-2 text-ink-2 outline-none focus:ring-2 focus:ring-[var(--ring)]", className)}>
      {allowNone && <option value="">No wallet</option>}
      {!known && <option value={value}>{shortAddr(value)}</option>}
      {wallets.map((w) => (
        <option key={w.id} value={w.address}>
          {w.isDefault ? "★ " : ""}
          {w.label ? `${w.label} · ${shortAddr(w.address)}` : shortAddr(w.address)}
        </option>
      ))}
    </select>
  );
}
