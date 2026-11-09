"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Check, CircleDashed, Clock, Eye, EyeOff, Layers, ShieldCheck, X as XIcon } from "lucide-react";
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
import type { Drop, DropDetail, DropStage, Eligibility, Verdict } from "@/lib/server/opensea-types";

type ListRes = { configured: boolean; drops: Drop[]; watch: MintWatch[]; error?: string };
type Kind = "upcoming" | "featured" | "watching";

const MANUAL = [
  { id: "unknown", label: "Not checked" },
  { id: "eligible", label: "Eligible" },
  { id: "not_eligible", label: "Not eligible" },
  { id: "applied", label: "Applied" },
  { id: "pending", label: "Pending" },
] as const;

const VERDICT: Record<Verdict, { tone: string; label: string }> = {
  eligible: { tone: "green", label: "Eligible" },
  not_eligible: { tone: "red", label: "Not eligible" },
  unknown: { tone: "gray", label: "Unknown" },
};

const stageName = (s: DropStage) => s.label || s.stage_type.replace(/_/g, " ");
function price(s?: DropStage | null) {
  if (!s || s.price == null) return "—";
  if (s.price === "0") return "Free";
  const native = /^0x0{40}$/i.test(s.price_currency_address);
  return `${Number(formatEther(BigInt(s.price))).toLocaleString(undefined, { maximumFractionDigits: 5 })} ${native ? "ETH" : "token"}`;
}
const autoOf = (w?: MintWatch) => (w?.auto as unknown as Eligibility | null) ?? null;
const publicOnly = (e: Eligibility | null) => Boolean(e && e.wallets.length && e.wallets.every((w) => w.verdict === "not_eligible" && w.stages.some((x) => /public/i.test(x.type))));
const bestVerdict = (e: Eligibility | null): Verdict | null => (!e ? null : e.wallets.some((w) => w.verdict === "eligible") ? "eligible" : e.wallets.length && e.wallets.every((w) => w.verdict === "not_eligible") ? "not_eligible" : "unknown");

export function MintsView() {
  const [kind, setKind] = useState<Kind>("upcoming");
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["mints", kind === "watching" ? "upcoming" : kind], queryFn: () => api<ListRes>(`/api/mints?type=${kind === "watching" ? "upcoming" : kind}`) });
  const watch = new Map((q.data?.watch ?? []).map((w) => [w.slug, w]));
  const rows: { slug: string; name: string; chain: string; image: string | null; stage: DropStage | null; live: boolean }[] =
    kind === "watching"
      ? (q.data?.watch ?? []).map((w) => ({ slug: w.slug, name: w.name ?? w.slug, chain: w.chain ?? "", image: null, stage: null, live: false }))
      : (q.data?.drops ?? []).map((d) => ({ slug: d.collection_slug, name: d.collection_name ?? d.collection_slug, chain: d.chain, image: d.image_url, stage: d.active_stage ?? d.next_stage, live: d.is_minting }));

  return (
    <Page>
      <PageHeader
        eyebrow="NFT"
        title="Upcoming mints"
        subtitle="Drops from OpenSea. Eligibility is checked against your saved wallets with public and on-chain data only — no signatures, no transactions."
      />
      <Tabs value={kind} onValueChange={(v) => setKind(v as Kind)} variant="underline">
        <TabsList className="mb-4">
          <TabsTrigger value="upcoming" icon={<Clock className="h-3.5 w-3.5" />}>Upcoming</TabsTrigger>
          <TabsTrigger value="featured" icon={<Layers className="h-3.5 w-3.5" />}>Featured</TabsTrigger>
          <TabsTrigger value="watching" icon={<Eye className="h-3.5 w-3.5" />}>Watching{q.data?.watch.length ? ` · ${q.data.watch.length}` : ""}</TabsTrigger>
        </TabsList>
      </Tabs>

      {q.isLoading ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : q.data && !q.data.configured ? (
        <EmptyState
          mark="spark"
          title="Connect OpenSea to see drops"
          body={<>Add <code className="num">OPENSEA_API_KEY</code> to the Vercel project (Production + Preview) and redeploy. Steps are in SETUP.md → OpenSea.</>}
          action={<Link href="/settings"><Button variant="outline">Open settings</Button></Link>}
        />
      ) : q.data?.error ? (
        <EmptyState mark="spark" title="OpenSea didn't answer" body={q.data.error} action={<Button onClick={() => q.refetch()}>Try again</Button>} />
      ) : rows.length === 0 ? (
        <EmptyState
          mark="spark"
          title={kind === "watching" ? "Nothing watched yet" : "No drops on the calendar"}
          body={kind === "watching" ? "Open a drop and press Watch to keep its WL status here." : "OpenSea has no drops of this kind right now. Check Featured, or come back later."}
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
          {rows.map((r) => {
            const w = watch.get(r.slug);
            const v = bestVerdict(autoOf(w));
            const manual = w && w.manualStatus !== "unknown" ? MANUAL.find((m) => m.id === w.manualStatus)?.label : null;
            return (
              <li key={r.slug}>
                <button onClick={() => setOpen(r.slug)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-hover sm:px-4">
                  {r.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.image} alt="" className="h-10 w-10 shrink-0 rounded-md border border-line object-cover" loading="lazy" />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line bg-hover text-muted"><Layers className="h-4 w-4" /></span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-medium text-ink">{r.name}</span>
                      {w && <Eye className="h-3.5 w-3.5 shrink-0 text-faint" aria-label="Watching" />}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
                      <span className="capitalize">{r.chain}</span>
                      {r.stage && <span>{stageName(r.stage)}</span>}
                      {r.stage && <span className="num">{price(r.stage)}</span>}
                    </div>
                  </div>
                  <div className="hidden shrink-0 items-center gap-3 sm:flex">
                    {v && (publicOnly(autoOf(w)) ? <Marker tone="gray">Public only</Marker> : <Marker tone={VERDICT[v].tone}>{VERDICT[v].label}</Marker>)}
                    {manual && <Pill tone="gray">{manual}</Pill>}
                  </div>
                  <div className="w-[118px] shrink-0 text-right text-[12.5px]">
                    {r.live ? <Marker tone="green" live>Minting</Marker> : r.stage ? <Countdown to={r.stage.start_time} compact /> : w?.startTime ? <Countdown to={new Date(w.startTime)} compact /> : <span className="text-faint">TBA</span>}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-[12px] text-faint">Source: OpenSea Drops API. Times shown in your local time zone.</p>
      {open && <DropDialog slug={open} onClose={() => setOpen(null)} />}
    </Page>
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
            <Pill tone="gray"><span className="capitalize">{d.chain}</span></Pill>
            <span className="num">{d.total_supply ?? "0"} / {d.max_supply ?? "∞"} minted</span>
            <a href={d.opensea_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-accent hover:underline">OpenSea <ArrowUpRight className="h-3 w-3" /></a>
          </div>

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
                      <span className="num text-[12.5px] text-ink-2">{price(s)} · max {s.max_per_wallet}/wallet</span>
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
