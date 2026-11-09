"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Newspaper, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { FeedItem } from "@/db/schema";
import { Page, PageHeader } from "@/components/shell";
import { Button, Pill, Skeleton } from "@/components/ui";
import { Tabs, TabsList, TabsTrigger } from "@/components/motion/tabs";
import { Loader } from "@/components/motion/loader";
import { PullToRefresh } from "@/components/motion/pull-to-refresh";
import { EmptyState } from "@/components/panelui/empty-state";
import { Post, type PostData } from "@/components/panelui/post";
import { BrandIcon } from "@/components/brand";
import { api, useAiConfig } from "@/lib/client/api";
import { toast } from "@/lib/client/toast";
import { today as todayStr } from "@/lib/dates";
import { cn } from "@/lib/cn";

const CAT_TONE: Record<string, string> = { airdrop: "amber", testnet: "blue", nft: "violet", degen: "red", news: "gray" };

function host(u: string | null) {
  try {
    return u ? new URL(u).hostname.replace(/^www\./, "") : null;
  } catch {
    return null;
  }
}

export function FeedView() {
  const [tab, setTab] = useState<"reading" | "x">("reading");
  return (
    <Page>
      <PageHeader eyebrow="Daily" title="Feed" subtitle="A short reading list picked by your research desk from live sources, plus your X timeline." />
      <Tabs value={tab} onValueChange={(v) => setTab(v as "reading" | "x")} variant="underline">
        <TabsList className="mb-5">
          <TabsTrigger value="reading" icon={<Newspaper className="h-3.5 w-3.5" />}>Reading list</TabsTrigger>
          <TabsTrigger value="x" icon={<BrandIcon id="x" size={14} />}>X timeline</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === "reading" ? <Reading /> : <XTimeline />}
    </Page>
  );
}

function Reading() {
  const qc = useQueryClient();
  const ai = useAiConfig();
  const q = useQuery({ queryKey: ["feed"], queryFn: () => api<{ items: FeedItem[] }>("/api/feed") });
  const [busy, setBusy] = useState(false);
  const today = todayStr();
  const items = q.data?.items ?? [];
  const todays = items.filter((i) => i.day === today);
  const shown = todays.length ? todays : items.filter((i) => i.day === items[0]?.day);
  const generate = async () => {
    setBusy(true);
    try {
      await toast.promise(api("/api/feed/generate", { method: "POST", body: { day: today } }), { loading: "Reading the sources…", success: "Today's list is ready", error: (e) => (e as Error).message });
      qc.invalidateQueries({ queryKey: ["feed"] });
    } catch {
      /* toast already shows the error */
    } finally {
      setBusy(false);
    }
  };
  if (q.isLoading) return <div className="space-y-3"><Skeleton className="h-40" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>;
  if (!ai.data?.configured)
    return <EmptyState mark="feed" title="Point the research desk at a model first" body="The reading list is written by your AI endpoint from DefiLlama, CoinGecko and GeckoTerminal data." action={<Link href="/settings#ai"><Button>Set up AI</Button></Link>} />;
  if (!shown.length)
    return <EmptyState mark="feed" title="No list for today yet" body="Generate one: the desk pulls fresh raises, trending tokens and new pools, then keeps only what links to a real source." action={<Button variant="primary" onClick={generate} disabled={busy}>{busy ? <Loader size={13} /> : <Sparkles className="h-3.5 w-3.5" />} Build today&apos;s list</Button>} />;
  const [lead, ...rest] = [...shown].sort((a, b) => b.score - a.score);
  return (
    <PullToRefresh onRefresh={generate} className="md:contents">
      <div className="mb-3 flex items-center justify-between text-[12px] text-muted">
        <span>{shown[0].day === today ? "Today" : `From ${shown[0].day}`} · {shown.length} picks</span>
        <Button size="sm" variant="ghost" onClick={generate} disabled={busy}>{busy ? <Loader size={12} /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh</Button>
      </div>
      <a href={lead.url ?? undefined} target="_blank" rel="noreferrer" className="group block rounded-xl border border-line bg-panel p-5 transition-colors hover:border-line-strong">
        <div className="mb-2 flex items-center gap-2 text-[11.5px] text-muted">
          {lead.category && <Pill tone={CAT_TONE[lead.category] ?? "gray"}>{lead.category}</Pill>}
          <span>{lead.source ?? host(lead.url)}</span>
          <span className="num ml-auto">{lead.score}</span>
        </div>
        <h3 className="font-serif text-[24px] leading-tight text-ink group-hover:underline group-hover:decoration-line-strong group-hover:underline-offset-4">{lead.title}</h3>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-2">{lead.summary}</p>
        {lead.url && <span className="mt-3 inline-flex items-center gap-1 text-[12.5px] text-accent">{host(lead.url)} <ArrowUpRight className="h-3 w-3" /></span>}
      </a>
      <ul className="mt-3 grid gap-x-6 sm:grid-cols-2">
        {rest.map((i) => (
          <li key={i.id} className="border-b border-line">
            <a href={i.url ?? undefined} target="_blank" rel="noreferrer" className="group block py-3.5">
              <div className="mb-1 flex items-center gap-2 text-[11.5px] text-muted">
                {i.category && <span className={cn("h-1.5 w-1.5 rounded-full", `dot-${CAT_TONE[i.category] ?? "gray"}`)} />}
                <span className="capitalize">{i.category ?? i.kind}</span>
                <span>·</span>
                <span className="truncate">{i.source ?? host(i.url)}</span>
                <span className="num ml-auto">{i.score}</span>
              </div>
              <div className="font-serif text-[17px] leading-snug text-ink group-hover:underline group-hover:decoration-line-strong group-hover:underline-offset-4">{i.title}</div>
              <p className="mt-1 line-clamp-2 text-[13px] text-ink-2">{i.summary}</p>
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] text-faint">Picks come only from what the desk&apos;s tools returned; scores are its conviction, not advice.</p>
    </PullToRefresh>
  );
}

function XTimeline() {
  const q = useQuery({ queryKey: ["x-feed"], queryFn: () => api<{ state: string; posts: PostData[]; message?: string; source?: string }>("/api/x/feed") });
  if (q.isLoading) return <div className="space-y-3"><Skeleton className="h-28" /><Skeleton className="h-28" /></div>;
  const s = q.data?.state;
  if (s === "not-configured") return <EmptyState mark="feed" title="X isn't set up" body={<>Add <code className="num">X_CLIENT_ID</code> and <code className="num">X_CLIENT_SECRET</code> (SETUP.md → X), redeploy, then connect X in Settings.</>} action={<Link href="/settings#connections"><Button>Open settings</Button></Link>} />;
  if (s === "not-connected" || s === "reconnect") return <EmptyState mark="feed" title={s === "reconnect" ? "Reconnect X" : "Connect your X account"} body={q.data?.message ?? "Your home timeline shows here once X is connected (read-only)."} action={<Link href="/settings#connections"><Button>Connected accounts</Button></Link>} />;
  if (s === "error") return <EmptyState mark="feed" title="X didn't answer" body={q.data?.message} action={<Button onClick={() => q.refetch()}>Try again</Button>} />;
  if (!q.data?.posts.length) return <EmptyState mark="feed" title="Nothing new on X" />;
  return (
    <div className="space-y-3">
      {q.data.posts.map((p) => <Post key={p.id} post={p} />)}
    </div>
  );
}
