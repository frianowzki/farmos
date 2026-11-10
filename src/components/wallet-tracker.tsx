"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button, SectionTitle, Skeleton } from "@/components/ui";
import { EVM_CHAINS } from "@/lib/chains";
import { chainMeta } from "@/lib/chain-meta";
import { ChainLogo, ChainStack } from "@/components/chain-logo";
import { WalletIcon } from "@/components/wallet-icon";
import { useWallets } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import { api, keys } from "@/lib/client/api";
import { toast } from "@/lib/client/toast";
import { num, shortAddr, tone, usd } from "@/lib/format";

type Holding = { chain: string; symbol: string; token: string | null; amount: number; usd: number | null };
type WalletTrack = { address: string; label: string; holdings: Holding[]; totalUsd: number; errors: string[] };
type PositionTrack = {
  positionId: string; projectId: string; projectName: string; token: string; chain: string; tokenAddress: string;
  recordedSize: number; onchainSize: number; entryPrice: number; currentPrice: number | null; costBasis: number; value: number | null; pnl: number | null;
};
type Snapshot = { fetchedAt: string; wallets: WalletTrack[]; positions: PositionTrack[]; totalUsd: number; sources: Record<string, string>; priceSource: string; cached: boolean };

const chainName = (k: string) => chainMeta(k)?.name ?? EVM_CHAINS.find((c) => c.key === k)?.name ?? k;

/** Server-side, read-only balances (Etherscan V2 + public RPC), cached 10 minutes. */
export function WalletTracker({ hasEvm }: { hasEvm: boolean }) {
  const { data: wl } = useWallets();
  const providerOf = (a: string) => wl?.wallets.find((w) => w.address.toLowerCase() === a.toLowerCase())?.provider ?? "";
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const { data, isLoading, error } = useQuery({ queryKey: ["wallet-track"], queryFn: () => api<Snapshot>("/api/wallets/track"), enabled: hasEvm, staleTime: 5 * 60_000 });

  if (!hasEvm) return null;
  const refresh = async () => {
    setRefreshing(true);
    try {
      qc.setQueryData(["wallet-track"], await api<Snapshot>("/api/wallets/track", { method: "POST" }));
    } catch (e) {
      toast.error((e as Error).message);
    }
    setRefreshing(false);
  };

  return (
    <div className="mb-8">
      <SectionTitle right={<Button size="sm" variant="ghost" disabled={refreshing || isLoading} onClick={refresh}><RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} /> Refresh</Button>}>Auto-tracked balances</SectionTitle>
      {isLoading ? (
        <Skeleton className="h-28" />
      ) : error || !data ? (
        <div className="rounded-lg border border-dashed border-line px-4 py-5 text-center text-[13px] text-muted">Couldn&apos;t load balances. {(error as Error)?.message}</div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="num text-[26px] font-medium tracking-tight">{usd(data.totalUsd)}</span>
            <span className="text-[12px] text-muted">
              Native + main tokens on {Object.keys(data.sources).length} chains · updated {new Date(data.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <div className="divide-y divide-line rounded-lg border border-line bg-panel">
            {data.wallets.map((w) => <TrackRow key={w.address} w={w} provider={providerOf(w.address)} />)}
          </div>
          <p className="mt-2 text-[11.5px] text-faint">Prices: {data.priceSource}. Sources: Etherscan V2 where your plan covers the chain, public RPC otherwise.</p>
          {data.positions.length > 0 && <OnchainPositions rows={data.positions} onSynced={refresh} />}
        </>
      )}
    </div>
  );
}

function TrackRow({ w, provider }: { w: WalletTrack; provider: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-hover/50">
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-faint transition-transform", !open && "-rotate-90")} />
        <WalletIcon provider={provider} size={22} />
        <span className="w-[130px] shrink-0 truncate text-[13.5px]">{w.label || <span className="text-faint">Unlabeled</span>}</span>
        <span className="num min-w-0 flex-1 truncate text-[12.5px] text-muted">{shortAddr(w.address)}</span>
        <span className="hidden sm:inline-flex"><ChainStack chains={w.holdings.map((h) => h.chain)} size={16} /></span>
        <span className="num w-[96px] text-right text-[13.5px]">{usd(w.totalUsd)}</span>
      </button>
      {open && (
        <div className="border-t border-line bg-bg/50 px-3 py-2">
          {w.holdings.length === 0 ? (
            <div className="py-2 text-[12.5px] text-muted">No balances on tracked chains.</div>
          ) : (
            <table className="w-full text-[12.5px]">
              <tbody>
                {w.holdings.map((h) => (
                  <tr key={`${h.chain}-${h.symbol}`} className="border-b border-line/60 last:border-0">
                    <td className="py-1.5 text-ink-2">{h.symbol}</td>
                    <td className="py-1.5 text-muted"><span className="inline-flex items-center gap-1.5"><ChainLogo chain={h.chain} size={14} />{chainName(h.chain)}</span></td>
                    <td className="num py-1.5 text-right">{num(h.amount, h.amount < 1 ? 6 : 4)}</td>
                    <td className="num w-[96px] py-1.5 text-right text-ink-2">{h.usd == null ? <span className="text-faint">no price</span> : usd(h.usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {w.errors.length > 0 && <div className="mt-1 text-[11.5px] text-faint">Skipped: {w.errors.join(" · ")}</div>}
        </div>
      )}
    </div>
  );
}

function OnchainPositions({ rows, onSynced }: { rows: PositionTrack[]; onSynced: () => void }) {
  const qc = useQueryClient();
  return (
    <div className="mt-6">
      <SectionTitle>Degen positions, on-chain</SectionTitle>
      <div className="overflow-x-auto rounded-lg border border-line bg-panel">
        <table className="w-full min-w-[560px] text-[12.5px]">
          <thead className="text-left text-[11.5px] text-muted">
            <tr className="border-b border-line">
              <th className="px-3 py-2 font-normal">Token</th>
              <th className="px-3 py-2 text-right font-normal">Recorded</th>
              <th className="px-3 py-2 text-right font-normal">In wallets</th>
              <th className="px-3 py-2 text-right font-normal">Cost basis</th>
              <th className="px-3 py-2 text-right font-normal">Value</th>
              <th className="px-3 py-2 text-right font-normal">PnL</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const drift = Math.abs(r.onchainSize - r.recordedSize) > Math.max(1e-9, r.recordedSize * 0.001);
              return (
                <tr key={r.positionId} className="border-b border-line/60 last:border-0">
                  <td className="px-3 py-2"><Link href={`/projects/${r.projectId}`} className="hover:underline">{r.token}</Link> <span className="text-faint">· {r.projectName} · {chainName(r.chain)}</span></td>
                  <td className="num px-3 py-2 text-right text-muted">{num(r.recordedSize, 4)}</td>
                  <td className={cn("num px-3 py-2 text-right", drift && "text-ink")}>{num(r.onchainSize, 4)}</td>
                  <td className="num px-3 py-2 text-right text-muted">{r.entryPrice > 0 ? usd(r.costBasis) : "no entry"}</td>
                  <td className="num px-3 py-2 text-right">{r.value == null ? <span className="text-faint">refresh price</span> : usd(r.value)}</td>
                  <td className={cn("num px-3 py-2 text-right", tone(r.pnl))}>{r.pnl == null ? "—" : usd(r.pnl, { sign: true })}</td>
                  <td className="px-3 py-2 text-right">
                    {drift && (
                      <Button size="sm" variant="ghost" onClick={async () => {
                        try {
                          await api(`/api/positions/${r.positionId}`, { method: "PATCH", body: { size: r.onchainSize } });
                          qc.invalidateQueries({ queryKey: keys.project(r.projectId) });
                          qc.invalidateQueries({ queryKey: keys.projects });
                          toast.success("Size synced from wallets");
                          onSynced();
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}>Use on-chain size</Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11.5px] text-faint">Open positions with a token address. PnL = on-chain size × (current − entry) price; current price comes from DexScreener refresh in Portfolio.</p>
    </div>
  );
}
