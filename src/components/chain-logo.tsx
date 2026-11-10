import { cn } from "@/lib/cn";
import { chainLogo, chainMeta } from "@/lib/chain-meta";

/** Official chain mark (self-hosted). Renders nothing for chains farmOS doesn't know. */
export function ChainLogo({ chain, size = 16, className, title }: { chain: string; size?: number; className?: string; title?: boolean }) {
  const m = chainMeta(chain);
  if (!m) return null;
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
      <ChainLogo chain={chain} size={size} />
      <span className="truncate">{m?.name ?? chain}</span>
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
