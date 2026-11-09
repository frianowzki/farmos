"use client";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Copy, ExternalLink, Link2, Plus, ShieldCheck, Trash2, Unplug } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "@/lib/client/toast";
import { formatUnits, isAddress } from "viem";
import { useAccount, useBalance, useDisconnect } from "wagmi";
import { Monogram, Page, PageHeader } from "@/components/shell";
import { Button, Input, InlineText, SectionTitle, Skeleton } from "@/components/ui";
import { WalletProvider, walletConnectReady } from "@/components/wallet-provider";
import { cn } from "@/lib/cn";
import { EVM_CHAINS, WALLET_CHAIN_KEYS } from "@/lib/chains";
import { num, shortAddr } from "@/lib/format";
import { api, keys, useProjects, useWallets } from "@/lib/client/api";

const CHAINS = WALLET_CHAIN_KEYS.map((k) => EVM_CHAINS.find((c) => c.key === k)!);

export function WalletsView() {
  return (
    <WalletProvider>
      <Inner />
    </WalletProvider>
  );
}

function Inner() {
  const { address, isConnected, connector } = useAccount();
  const { disconnect } = useDisconnect();
  const { data, isLoading } = useWallets();
  const qc = useQueryClient();
  const [addr, setAddr] = useState("");
  const [label, setLabel] = useState("");
  const linked = data?.wallets ?? [];
  const isLinked = address && linked.some((w) => w.address.toLowerCase() === address.toLowerCase());

  const add = async (a: string, l: string) => {
    try {
      await api("/api/wallets", { method: "POST", body: { address: a, label: l } });
      qc.invalidateQueries({ queryKey: keys.wallets });
      setAddr("");
      setLabel("");
      toast.success("Wallet linked");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Page>
      <PageHeader eyebrow="Workspace" title="Wallets" subtitle="Read-only. farmOS never asks for signatures or sends transactions." />

      <div className="mb-8 rounded-xl border border-line bg-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-hover text-muted"><ShieldCheck className="h-4 w-4" /></div>
            <div>
              <div className="text-[14px] font-medium">{isConnected ? shortAddr(address) : "No wallet connected"}</div>
              <div className="text-[12.5px] text-muted">{isConnected ? `via ${connector?.name ?? "wallet"}` : walletConnectReady ? "Browser wallets and WalletConnect" : "Browser wallets (injected). WalletConnect needs a project id."}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isConnected && address && !isLinked && <Button size="sm" variant="primary" onClick={() => add(address, connector?.name ?? "")}><Link2 className="h-3.5 w-3.5" /> Link to farmOS</Button>}
            {isConnected ? (
              <Button size="sm" variant="ghost" onClick={() => disconnect()}><Unplug className="h-3.5 w-3.5" /> Disconnect</Button>
            ) : (
              <ConnectButton.Custom>
                {({ openConnectModal, mounted }) => (
                  <Button variant="primary" disabled={!mounted} onClick={openConnectModal}>Connect wallet</Button>
                )}
              </ConnectButton.Custom>
            )}
          </div>
        </div>
        {isConnected && address && <div className="mt-4 border-t border-line pt-4"><Balances address={address} /></div>}
      </div>

      <SectionTitle>Linked wallets</SectionTitle>
      <form onSubmit={(e) => { e.preventDefault(); if (addr.trim()) add(addr.trim(), label.trim()); }} className="mb-3 flex flex-wrap gap-2">
        <Input value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="0x… or Solana address (watch-only)" className="num min-w-[240px] flex-[2]" />
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label, e.g. Farm 03" className="min-w-[140px] flex-1" />
        <Button type="submit" disabled={!addr.trim()}><Plus className="h-3.5 w-3.5" /> Add</Button>
      </form>
      {isLoading ? (
        <Skeleton className="h-24" />
      ) : linked.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-[13.5px] text-muted">Link your farming wallets to tag them on projects and check balances across chains.</div>
      ) : (
        <div className="divide-y divide-line rounded-lg border border-line bg-panel">
          {linked.map((w) => <WalletRow key={w.id} w={w} />)}
        </div>
      )}
    </Page>
  );
}

function WalletRow({ w }: { w: { id: string; address: string; label: string } }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { data } = useProjects();
  const used = (data?.projects ?? []).filter((p) => p.wallets.some((x) => x.toLowerCase() === w.address.toLowerCase()));
  const evm = isAddress(w.address);
  return (
    <div>
      <div className="group flex items-center gap-3 px-3 py-2">
        <button onClick={() => evm && setOpen((o) => !o)} className={cn("rounded p-0.5 text-faint", evm ? "hover:text-ink" : "opacity-30")} aria-label="Show balances">
          <ChevronDown className={cn("h-4 w-4 transition-transform", !open && "-rotate-90")} />
        </button>
        <div className="w-[160px] shrink-0">
          <InlineText value={w.label} placeholder="Add label" onSave={async (v) => { await api(`/api/wallets/${w.id}`, { method: "PATCH", body: { label: v } }); qc.invalidateQueries({ queryKey: keys.wallets }); }} />
        </div>
        <span className="num min-w-0 flex-1 truncate text-[12.5px] text-ink-2">{w.address}</span>
        <div className="hidden items-center gap-1 sm:flex">{used.slice(0, 3).map((p) => <Link key={p.id} href={`/projects/${p.id}`} title={p.name}><Monogram name={p.name} size={18} /></Link>)}{used.length > 3 && <span className="text-[11.5px] text-faint">+{used.length - 3}</span>}</div>
        <button onClick={() => { navigator.clipboard.writeText(w.address); toast.success("Copied"); }} className="rounded p-1 text-faint hover:text-ink" aria-label="Copy"><Copy className="h-3.5 w-3.5" /></button>
        {evm && <a href={`https://debank.com/profile/${w.address}`} target="_blank" rel="noreferrer" className="rounded p-1 text-faint hover:text-ink" aria-label="Open in DeBank"><ExternalLink className="h-3.5 w-3.5" /></a>}
        <button onClick={async () => { if (!confirm("Unlink this wallet?")) return; await api(`/api/wallets/${w.id}`, { method: "DELETE" }); qc.invalidateQueries({ queryKey: keys.wallets }); }} className="rounded p-1 text-faint opacity-0 hover:text-neg group-hover:opacity-100" aria-label="Unlink"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
      {open && evm && <div className="border-t border-line bg-bg/50 px-3 py-3"><Balances address={w.address as `0x${string}`} /></div>}
    </div>
  );
}

function Balances({ address }: { address: `0x${string}` }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {CHAINS.map((c) => <BalanceCell key={c.key} address={address} chainId={c.chain.id} name={c.name} />)}
    </div>
  );
}

function BalanceCell({ address, chainId, name }: { address: `0x${string}`; chainId: number; name: string }) {
  const { data, isLoading, isError } = useBalance({ address, chainId, query: { staleTime: 60_000, retry: 1 } });
  const v = data ? Number(formatUnits(data.value, data.decimals)) : null;
  return (
    <div className="rounded-lg border border-line bg-panel px-3 py-2">
      <div className="text-[11.5px] text-muted">{name}</div>
      <div className={cn("num text-[14px]", v === 0 && "text-faint")}>
        {isLoading ? <span className="text-faint">…</span> : isError ? <span className="text-[12px] text-faint">RPC error</span> : `${num(v, v && v < 1 ? 5 : 4)} ${data?.symbol ?? ""}`}
      </div>
    </div>
  );
}
