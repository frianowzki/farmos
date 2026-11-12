"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, BadgeCheck, Check, CircleDashed, Clock, Eye, EyeOff, History, Layers, ShieldCheck, Sparkles, X as XIcon, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatEther } from "viem";
import type { MintWatch } from "@/db/schema";
import { Page, PageHeader } from "@/components/shell";
import { Button, Dialog, Field, Input, NativeSelect, Pill, Skeleton, Textarea } from "@/components/ui";
import { Tabs, TabsList, TabsTrigger } from "@/components/motion/tabs";
import { Loader } from "@/components/motion/loader";
import { Countdown } from "@/components/panelui/countdown";
import { EmptyState } from "@/components/panelui/empty-state";
import { Marker } from "@/components/panelui/marker";
import { api, useWallets } from "@/lib/client/api";
import { toast } from "@/lib/client/toast";
import { cn } from "@/lib/cn";
import type { DropDetail, DropRich, DropStage, Eligibility, Verdict } from "@/lib/server/opensea-types";
import { ChainLogo } from "@/components/chain-logo";
import { LinkIcon } from "@/components/icons/brand-glyphs";

type ListRes = { configured: boolean; drops: DropRich[]; watch: MintWatch[]; error?: string };
type Kind = "upcoming" | "live" | "featured" | "recent" | "watching";

const MANUAL = [
  { id: "unknown", label: "Not checked", tone: "gray" },
  { id: "eligible", label: "Eligible", tone: "green" },
  { id: "not_eligible", label: "Not eligible", tone: "red" },
  { id: "applied", label: "Applied", tone: "blue" },
  { id: "pending", label: "Pending", tone: "amber" },
] as const;

const VERDICT: Record<Verdict, { tone: string; label: string }> = {
  eligible: { tone: "green", label: "Eligible" },
  not_eligible: { tone: "red", label: "Not eligible" },
  unknown: { tone: "gray", label: "Unknown" },
};

const stageName = (s: DropStage) => s.label || s.stage_type.replace(/_/g, " ");
const NATIVE: Record<string, string> = { ethereum: "ETH", base: "ETH", arbitrum: "ETH", optimism: "ETH", zora: "ETH", blast: "ETH", ink: "ETH", shape: "ETH", abstract: "ETH", unichain: "ETH", polygon: "POL", matic: "POL", avalanche: "AVAX", bsc: "BNB", ape_chain: "APE", apechain: "APE", sei: "SEI", flow: "FLOW", ronin: "RON", hyperevm: "HYPE", elysium: "HYPE", arc: "USDC", monad: "MON", berachain: "BERA", soneium: "ETH", b3: "ETH", gunzilla: "GUN", somnia: "SOMI", animechain: "ANIME" };
function priceOf(raw: string | null | undefined, currency: string | null | undefined, chain = "ethereum") {
  if (raw == null) return "—";
  if (raw === "0") return "Free";
  const native = !currency || /^0x0{40}$/i.test(currency);
  return `${Number(formatEther(BigInt(raw))).toLocaleString(undefined, { maximumFractionDigits: 5 })} ${native ? NATIVE[chain] ?? "ETH" : "token"}`;
}
const price = (s?: DropStage | null, chain?: string) => (s ? priceOf(s.price, s.price_currency_address, chain) : "—");
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const autoOf = (w?: MintWatch) => (w?.auto as unknown as Eligibility | null) ?? null;
const publicOnly = (e: Eligibility | null) => Boolean(e && e.wallets.length && e.wallets.every((w) => w.verdict === "not_eligible" && w.stages.some((x) => /public/i.test(x.type))));
const bestVerdict = (e: Eligibility | null): Verdict | null => (!e ? null : e.wallets.some((w) => w.verdict === "eligible") ? "eligible" : e.wallets.length && e.wallets.every((w) => w.verdict === "not_eligible") ? "not_eligible" : "unknown");

const KINDS: { id: Kind; label: string; icon: typeof Clock }[] = [
  { id: "live", label: "Minting", icon: Zap },
  { id: "upcoming", label: "Upcoming", icon: Clock },
  { id: "featured", label: "Featured", icon: Sparkles },
  { id: "recent", label: "Recently minted", icon: History },
  { id: "watching", label: "Watching", icon: Eye },
];

export function MintsView() {
  const [kind, setKind] = useState<Kind>("live");
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["mints"], queryFn: () => api<ListRes>("/api/mints"), staleTime: 5 * 60_000 });
  const watch = new Map((q.data?.watch ?? []).map((w) => [w.slug, w]));
  const drops = q.data?.drops ?? [];
  const shown =
    kind === "upcoming" ? drops.filter((d) => d.kinds.includes("upcoming") && !d.is_minting)
    : kind === "live" ? drops.filter((d) => d.is_minting)
    : kind === "featured" ? drops.filter((d) => d.kinds.includes("featured"))
    : kind === "recent" ? drops.filter((d) => d.kinds.includes("recently_minted"))
    : [];
  const count = (k: Kind) => (k === "watching" ? q.data?.watch.length ?? 0 : null);
  const sorted = [...shown].sort((a, b) => Number(b.is_minting) - Number(a.is_minting) || (a.active_stage ?? a.next_stage)?.start_time.localeCompare((b.active_stage ?? b.next_stage)?.start_time ?? "9") || 0);

  return (
    <Page>
      <PageHeader
        title="Upcoming mints"
        subtitle="Drops from OpenSea. Eligibility is checked against your saved wallets with public and on-chain data only — no signatures, no transactions."
      />
      <Tabs value={kind} onValueChange={(v) => setKind(v as Kind)} variant="underline">
        <TabsList mobileArrows={false} className="mb-4 overflow-x-auto [scrollbar-width:none]">
          {KINDS.map((k) => <TabsTrigger key={k.id} value={k.id} icon={<k.icon className="h-3.5 w-3.5" />}>{k.label}{count(k.id) ? ` · ${count(k.id)}` : ""}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      {q.isLoading ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : q.data && !q.data.configured ? (
        <EmptyState
          mark="spark"
          title="Connect OpenSea to see drops"
          body={<>Add <code className="num">OPENSEA_API_KEY</code> to the Vercel project (Production + Preview) and redeploy. Steps are in SETUP.md → OpenSea.</>}
          action={<Link href="/settings"><Button variant="outline">Open settings</Button></Link>}
        />
      ) : q.data?.error ? (
        <EmptyState mark="spark" title="OpenSea didn't answer" body={q.data.error} action={<Button onClick={() => q.refetch()}>Try again</Button>} />
      ) : kind === "watching" ? (
        (q.data?.watch ?? []).length === 0 ? (
          <EmptyState mark="spark" title="Nothing watched yet" body="Open a drop and press Watch to keep its WL status here." />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
            {(q.data?.watch ?? []).map((w) => {
              const d = drops.find((x) => x.collection_slug === w.slug);
              return d ? <DropRow key={w.slug} d={d} w={w} onOpen={() => setOpen(w.slug)} /> : (
                <li key={w.slug}>
                  <button onClick={() => setOpen(w.slug)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-hover">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-line bg-hover text-muted"><Layers className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">{w.name ?? w.slug}</span>
                    {w.startTime ? <Countdown to={new Date(w.startTime)} compact /> : <span className="text-[12.5px] text-faint">TBA</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )
      ) : sorted.length === 0 ? (
        <EmptyState mark="spark" title="No drops here right now" body="OpenSea has nothing listed for this filter. Try another tab, or come back later." />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
          {sorted.map((d) => <DropRow key={d.collection_slug} d={d} w={watch.get(d.collection_slug)} onOpen={() => setOpen(d.collection_slug)} />)}
        </ul>
      )}
      {open && <DropDialog slug={open} onClose={() => setOpen(null)} />}
    </Page>
  );
}

function DropRow({ d, w, onOpen }: { d: DropRich; w?: MintWatch; onOpen: () => void }) {
  const v = bestVerdict(autoOf(w));
  const manual = w && w.manualStatus !== "unknown" ? MANUAL.find((m) => m.id === w.manualStatus)?.label : null;
  const stage = d.active_stage ?? d.next_stage;
  const minted = Number(d.total_supply ?? 0);
  const max = Number(d.max_supply ?? 0);
  const links = (["x", "site", "discord"] as const).filter((k) => d.links[k]);
  return (
    <li className="group relative">
      <button onClick={onOpen} className="flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-hover sm:px-4">
        {d.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.image_url} alt="" className="h-12 w-12 shrink-0 rounded-lg border border-line object-cover" loading="lazy" />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-line bg-hover text-muted"><Layers className="h-4 w-4" /></span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-medium text-ink">{d.collection_name ?? d.collection_slug}</span>
            {d.safelist === "verified" && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-accent" aria-label="Verified on OpenSea" />}
            {w && <Eye className="h-3.5 w-3.5 shrink-0 text-faint" aria-label="Watching" />}
          </div>
          {d.description && <p className="mt-0.5 line-clamp-1 text-[12.5px] text-muted">{d.description}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
            <span className="inline-flex items-center gap-1 capitalize"><ChainLogo chain={d.chain} size={13} />{d.chain.replace(/_/g, " ")}</span>
            {stage && <span className="capitalize">{stageName(stage)}</span>}
            <span className="num text-ink-2">{stage ? price(stage, d.chain) : priceOf(d.public_price, d.price_currency_address, d.chain)}</span>
            {max > 0 && <span className="num">{minted.toLocaleString()} / {max.toLocaleString()}</span>}
            {d.stage_count > 1 && <span>{d.stage_count} stages</span>}
            {stage && <span className="num">{when(stage.start_time)}</span>}
          </div>
          {max > 0 && minted > 0 && <div className="mt-1.5 h-1 w-full max-w-[220px] overflow-hidden rounded-full bg-hover"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (minted / max) * 100)}%` }} /></div>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5 text-[12.5px]">
          {d.is_minting ? <Marker tone="green" live>Minting</Marker> : stage ? <Countdown to={stage.start_time} compact /> : <span className="text-faint">TBA</span>}
          <div className="flex items-center gap-2">
            {v && (publicOnly(autoOf(w)) ? <Marker tone="gray">Public only</Marker> : <Marker tone={VERDICT[v].tone}>{VERDICT[v].label}</Marker>)}
            {manual && <Pill tone="gray">{manual}</Pill>}
          </div>
        </div>
      </button>
      {(
        <div className="absolute bottom-2.5 right-3 flex items-center gap-1">
          <a href={`https://opensea.io/collection/${d.collection_slug}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="rounded transition-opacity hover:opacity-80" aria-label="Open on OpenSea" title="Open on OpenSea">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/opensea.png" alt="" width={16} height={16} className="h-4 w-4" loading="lazy" />
          </a>
          {links.map((k) => <a key={k} href={d.links[k]!} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="rounded bg-panel/90 p-1 text-faint shadow-sm ring-1 ring-line hover:text-ink" aria-label={k}><LinkIcon field={k} className="h-3.5 w-3.5" /></a>)}
        </div>
      )}
    </li>
  );
}

function DropDialog({ slug, onClose }: { slug: string; onClose: () => void }) {
  const qc = useQueryClient();
  const wallets = useWallets();
  const walletCount = wallets.data?.wallets.length ?? 0;
  const router = useRouter();
  const q = useQuery({ queryKey: ["mint", slug], queryFn: () => api<{ configured: boolean; drop: DropDetail | null; watch: MintWatch | null; error?: string }>(`/api/mints/${slug}`) });
  const [checking, setChecking] = useState(false);
  const d = q.data?.drop;
  const w = q.data?.watch ?? undefined;
  const rich = (qc.getQueryData<ListRes>(["mints"])?.drops ?? []).find((x) => x.collection_slug === slug);
  const auto = autoOf(w);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["mint", slug] });
    qc.invalidateQueries({ queryKey: ["mints"] });
  };

  const save = async (patch: Record<string, unknown>) => {
    try {
      await api(`/api/mints/${slug}`, { method: "PATCH", body: { name: d?.collection_name ?? w?.name, chain: d?.chain ?? w?.chain, contract: d?.contract_address ?? w?.contract, startTime: d?.next_stage?.start_time ?? d?.active_stage?.start_time ?? null, ...patch } });
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const check = async () => {
    setChecking(true);
    try {
      await api(`/api/mints/${slug}/check`, { method: "POST" });
      refresh();
      toast.success("Eligibility checked");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setChecking(false);
    }
  };
  const track = async () => {
    try {
      const r = await api<{ projectId: string }>(`/api/mints/${slug}/track`, { method: "POST" });
      refresh();
      router.push(`/projects/${r.projectId}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const unwatch = async () => {
    await api(`/api/mints/${slug}`, { method: "DELETE" });
    refresh();
    toast.success("Removed from watching");
  };

  const stages = [...(d?.stages ?? [])].sort((a, b) => a.start_time.localeCompare(b.start_time));
  return (
    <Dialog open onClose={onClose} title={d?.collection_name ?? w?.name ?? slug} width={640}>
      {q.isLoading ? (
        <div className="flex justify-center py-10"><Loader variant="dots" size={28} /></div>
      ) : !d ? (
        <p className="text-[13.5px] text-muted">{q.data?.error ?? "This drop is no longer listed on OpenSea."}</p>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
            <Pill tone="gray"><span className="inline-flex items-center gap-1 capitalize"><ChainLogo chain={d.chain} size={12} />{d.chain.replace(/_/g, " ")}</span></Pill>
            <span className="num">{d.total_supply ?? "0"} / {d.max_supply ?? "∞"} minted</span>
            <a href={d.opensea_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-accent hover:underline">OpenSea <ArrowUpRight className="h-3 w-3" /></a>
            {rich && (["x", "site", "discord", "telegram"] as const).filter((k) => rich.links[k]).map((k) => (
              <a key={k} href={rich.links[k]!} target="_blank" rel="noreferrer" className="rounded p-1 text-muted hover:bg-hover hover:text-ink" aria-label={k}><LinkIcon field={k} /></a>
            ))}
          </div>
          {rich?.banner_image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={rich.banner_image_url} alt="" className="h-28 w-full rounded-lg border border-line object-cover" loading="lazy" />
          )}
          {rich?.description && <p className="line-clamp-4 text-[13px] leading-relaxed text-ink-2">{rich.description}</p>}

          <section>
            <h3 className="mb-2 font-label text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Stages</h3>
            <ol className="relative space-y-3 border-l border-line pl-4">
              {stages.map((s) => {
                const live = d.active_stage?.uuid === s.uuid;
                return (
                  <li key={s.uuid} className="relative">
                    <span className={cn("absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-panel", live ? "bg-pos" : "bg-line-strong")} />
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-[13.5px] font-medium capitalize text-ink">{stageName(s)}</span>
                      <span className="num text-[12.5px] text-ink-2">{price(s, d.chain)} · max {s.max_per_wallet}/wallet</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-3 text-[12px] text-muted">
                      <span className="num">{new Date(s.start_time).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
                      {live ? <Marker tone="green" live>Live</Marker> : new Date(s.start_time) > new Date() && <Countdown to={s.start_time} compact />}
                      {s.allowlist_wallet_count != null && <span>{s.allowlist_wallet_count.toLocaleString()} wallets listed</span>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-label text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Your wallets</h3>
              <Button size="sm" onClick={check} disabled={checking || !walletCount}>
                {checking ? <Loader variant="spinner" size={13} /> : <ShieldCheck className="h-3.5 w-3.5" />} {auto ? "Re-check" : "Check eligibility"}
              </Button>
            </div>
            {!walletCount ? (
              <p className="text-[13px] text-muted">Save a wallet on the <Link href="/wallets" className="text-accent hover:underline">Wallets</Link> page to auto-check WL status.</p>
            ) : !auto ? (
              <p className="text-[13px] text-muted">Not checked yet. farmOS asks OpenSea about the live stage and reads SeaDrop&apos;s on-chain allowlist and token gates for your {walletCount} saved wallet{walletCount > 1 ? "s" : ""}.</p>
            ) : (
              <ul className="divide-y divide-line rounded-lg border border-line">
                {auto.wallets.map((r) => (
                  <li key={r.address} className="px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-[13px] text-ink">{r.label || "Wallet"} <span className="num text-muted">{r.address.slice(0, 6)}…{r.address.slice(-4)}</span></span>
                      <VerdictTag v={r.verdict} publicOnly={r.verdict === "not_eligible" && r.stages.some((x) => /public/i.test(x.type))} />
                    </div>
                    <ul className="mt-1.5 space-y-0.5">
                      {r.stages.map((s, i) => (
                        <li key={i} className="flex gap-2 text-[12px] text-muted"><span className="w-24 shrink-0 truncate capitalize text-ink-2">{s.stage}</span><span>{s.how}</span></li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
            {auto && <p className="mt-1.5 text-[11.5px] text-faint">Checked {new Date(auto.checkedAt).toLocaleString()}.{auto.merkle.note ? ` ${auto.merkle.note}` : ""}</p>}
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <Field label="Manual WL status">
              <NativeSelect value={w?.manualStatus ?? "unknown"} onChange={(v) => save({ manualStatus: v })} options={MANUAL} />
            </Field>
            <Field label="Project's own checker">
              <Input key={w?.checkerUrl ?? ""} defaultValue={w?.checkerUrl ?? ""} placeholder="https://" onBlur={(e) => e.target.value !== (w?.checkerUrl ?? "") && save({ checkerUrl: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Note">
                <Textarea key={w?.note ?? ""} rows={2} defaultValue={w?.note ?? ""} placeholder="Which wallet applied, raffle form, role needed…" onBlur={(e) => e.target.value !== (w?.note ?? "") && save({ note: e.target.value })} />
              </Field>
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
            <div className="flex gap-2">
              {w ? (
                <Button variant="ghost" size="sm" onClick={unwatch}><EyeOff className="h-3.5 w-3.5" /> Stop watching</Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => save({}).then(() => toast.success("Watching"))}><Eye className="h-3.5 w-3.5" /> Watch</Button>
              )}
              {w?.checkerUrl && <a href={w.checkerUrl} target="_blank" rel="noreferrer"><Button variant="ghost" size="sm">Open checker <ArrowUpRight className="h-3 w-3" /></Button></a>}
            </div>
            {w?.projectId ? (
              <Link href={`/projects/${w.projectId}`}><Button size="sm" variant="outline">Open project</Button></Link>
            ) : (
              <Button size="sm" variant="primary" onClick={track}><Layers className="h-3.5 w-3.5" /> Track as project</Button>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}

function VerdictTag({ v, publicOnly }: { v: Verdict; publicOnly?: boolean }) {
  const Icon = v === "eligible" ? Check : v === "not_eligible" ? XIcon : CircleDashed;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[12.5px] font-medium", v === "eligible" ? "text-pos" : v === "not_eligible" ? (publicOnly ? "text-ink-2" : "text-neg") : "text-muted")}>
      <Icon className="h-3.5 w-3.5" /> {publicOnly ? "Public stage only" : VERDICT[v].label}
    </span>
  );
}
