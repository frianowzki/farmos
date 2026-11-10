import { cn } from "@/lib/cn";
import { chainLogo, chainMeta } from "@/lib/chain-meta";

/** Official chain mark (self-hosted). Unknown chains render nothing, or a small initial badge with `fallback`. */
export function ChainLogo({ chain, size = 16, className, title, fallback }: { chain: string; size?: number; className?: string; title?: boolean; fallback?: boolean }) {
  const m = chainMeta(chain);
  if (!m) {
    if (!fallback || !chain.trim()) return null;
    return (
      <span
        aria-hidden
        className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-hover font-medium uppercase leading-none text-muted shadow-[inset_0_0_0_0.5px_var(--line-strong,rgba(127,127,127,0.4))]", className)}
        style={{ width: size, height: size, fontSize: Math.max(7, Math.round(size * 0.55)) }}
      >
        {chain.trim()[0]}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={chainLogo(m.key)}
      width={size}
      height={size}
      alt={title ? m.name : ""}
      aria-hidden={title ? undefined : true}
      title={title ? m.name : undefined}
      loading="lazy"
      className={cn("inline-block shrink-0 rounded-full object-cover shadow-[0_0_0_0.5px_rgba(0,0,0,0.12)]", className)}
      style={{ width: size, height: size }}
    />
  );
}

/** Logo + name, for pills and option rows. */
export function ChainLabel({ chain, size = 14 }: { chain: string; size?: number }) {
  const m = chainMeta(chain);
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <ChainLogo chain={chain} size={size} fallback />
      <span className="truncate">{m?.name ?? chain}</span>
    </span>
  );
}

/** Inline "[logo] Solana · [logo] Base" for card subtitles. */
export function ChainInline({ chains, size = 14, max = 2, className }: { chains: string[]; size?: number; max?: number; className?: string }) {
  const list = chains.slice(0, max);
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5 overflow-hidden", className)}>
      {list.map((c, i) => (
        <span key={c} className="inline-flex min-w-0 items-center gap-1.5">
          {i > 0 && <span aria-hidden className="text-faint">·</span>}
          <ChainLabel chain={c} size={size} />
        </span>
      ))}
      {chains.length > max && <span className="shrink-0 text-faint">+{chains.length - max}</span>}
    </span>
  );
}

/** Overlapping stack of chain logos (e.g. chains a wallet holds tokens on). */
export function ChainStack({ chains, size = 16, max = 6 }: { chains: string[]; size?: number; max?: number }) {
  const list = [...new Set(chains.map((c) => chainMeta(c)?.key).filter(Boolean) as string[])];
  return (
    <span className="inline-flex items-center">
      {list.slice(0, max).map((k, i) => (
        <span key={k} className="rounded-full ring-2 ring-panel" style={{ marginLeft: i ? -size * 0.22 : 0 }}>
          <ChainLogo chain={k} size={size} title />
        </span>
      ))}
      {list.length > max && <span className="ml-1 text-[11px] text-faint">+{list.length - max}</span>}
    </span>
  );
}
