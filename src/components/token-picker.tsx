"use client";
import { Check, ChevronDown, Search } from "lucide-react";
import { useState } from "react";
import { Popover } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useCoinSearch, type CoinHit } from "@/lib/client/prices";

export type PickedCoin = Pick<CoinHit, "id" | "name" | "symbol" | "thumb">;

export function CoinGlyph({ coin, size = 20 }: { coin: Pick<CoinHit, "symbol" | "thumb"> & { image?: string | null }; size?: number }) {
  const src = coin.thumb ?? coin.image ?? null;
  const [broken, setBroken] = useState<string | null>(null);
  if (src && broken !== src)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-full bg-hover" style={{ width: size, height: size }} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(src)} />;
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-hover font-label text-[9px] font-semibold text-muted" style={{ width: size, height: size }}>
      {coin.symbol.slice(0, 3)}
    </span>
  );
}

/** Searchable CoinGecko token selector, same quiet trigger + popover as the app's other selectors. */
export function TokenPicker({ value, onChange, className, compact }: { value: PickedCoin | null; onChange: (c: PickedCoin) => void; className?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [btn, setBtn] = useState<HTMLButtonElement | null>(null);
  const res = useCoinSearch(open ? q : "");
  return (
    <>
      <button
        ref={setBtn}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn("inline-flex h-9 min-w-0 items-center gap-2 rounded-md border border-line bg-panel pl-2 pr-2 text-left text-[13.5px] font-medium transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] sm:h-8", className)}
      >
        {value ? <CoinGlyph coin={value} size={18} /> : <Search className="h-3.5 w-3.5 text-muted" />}
        <span className="min-w-0 flex-1 truncate">{value ? (compact ? value.symbol : <>{value.symbol} <span className="font-normal text-muted">{value.name}</span></>) : <span className="font-normal text-faint">Pick a token</span>}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
      <Popover anchor={btn} open={open} onClose={() => setOpen(false)} width={300}>
        <div className="sticky top-0 z-[1] -mx-1 -mt-1 mb-1 border-b border-line bg-panel p-1.5">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search CoinGecko: name, symbol or id"
            className="h-8 w-full rounded-md bg-hover px-2 text-[16px] outline-none placeholder:text-faint sm:text-[13px]"
          />
        </div>
        <div role="listbox">
          {res.isLoading && <div className="px-2 py-3 text-[12.5px] text-faint">Searching…</div>}
          {res.data?.length === 0 && <div className="px-2 py-3 text-[12.5px] text-faint">No token matches “{q}”.</div>}
          {res.data?.map((c) => (
            <button
              key={c.id}
              type="button"
              role="option"
              aria-selected={c.id === value?.id}
              onClick={() => { onChange({ id: c.id, name: c.name, symbol: c.symbol, thumb: c.thumb }); setOpen(false); setQ(""); }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-hover"
            >
              <CoinGlyph coin={c} size={18} />
              <span className="min-w-0 flex-1 truncate text-[13px]"><span className="font-medium">{c.symbol}</span> <span className="text-muted">{c.name}</span></span>
              {c.rank ? <span className="num text-[11px] text-faint">#{c.rank}</span> : null}
              {c.id === value?.id && <Check className="h-3.5 w-3.5 text-muted" />}
            </button>
          ))}
        </div>
      </Popover>
    </>
  );
}
