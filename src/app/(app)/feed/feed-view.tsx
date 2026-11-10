"use client";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { ArrowUpRight, Newspaper, Plus, Radio, RefreshCw, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { FeedItem } from "@/db/schema";
import { Page, PageHeader } from "@/components/shell";
import { Button, NativeSelect, Pill, Skeleton } from "@/components/ui";
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

type XFeed = { state: string; posts: PostData[]; message?: string; source?: string };

export function FeedView() {
  const [tab, setTab] = useState<"reading" | "wire" | "x">("reading");
  // The X tab only shows when the connected app can actually read timelines (paid X API plans).
  // Otherwise the free News wire covers the same ground and no plan error is shown.
  const x = useQuery({ queryKey: ["x-feed"], queryFn: () => api<XFeed>("/api/x/feed"), staleTime: 10 * 60_000, retry: false });
  const xOk = x.data?.state === "ok";
  const active = tab === "x" && !xOk ? "wire" : tab;
  return (
    <Page>
      <PageHeader title="Feed" subtitle="A short reading list picked by your research desk, plus a live wire of crypto headlines." />
      <Tabs value={active} onValueChange={(v) => setTab(v as "reading" | "wire" | "x")} variant="underline">
        <TabsList className="mb-5">
          <TabsTrigger value="reading" icon={<Sparkles className="h-3.5 w-3.5" />}>Reading list</TabsTrigger>
          <TabsTrigger value="wire" icon={<Radio className="h-3.5 w-3.5" />}>News wire</TabsTrigger>
          {xOk && <TabsTrigger value="x" icon={<BrandIcon id="x" size={14} />}>X timeline</TabsTrigger>}
        </TabsList>
      </Tabs>
      {active === "reading" ? <Reading /> : active === "wire" ? <NewsWire /> : <XTimeline q={x} />}
    </Page>
  );
}

const CATS = [
  { id: "all", label: "All" },
  { id: "airdrop", label: "Airdrop" },
  { id: "testnet", label: "Testnet" },
  { id: "nft", label: "NFT" },
  { id: "degen", label: "Degen" },
  { id: "news", label: "News" },
];

const READ_KEY = "frioos-feed-read";
function useReadSet() {
  // Items render only after the client fetch, so reading localStorage on first client render is hydration-safe.
  const [read, setRead] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      return new Set(JSON.parse(localStorage.getItem(READ_KEY) ?? "[]") as string[]);
    } catch {
      return new Set();
    }
  });
  const mark = (id: string) =>
    setRead((r) => {
      const n = new Set(r).add(id);
      localStorage.setItem(READ_KEY, JSON.stringify([...n].slice(-300)));
      return n;
    });
  return [read, mark] as const;
}

function Favicon({ url, size = 16 }: { url: string | null; size?: number }) {
  const h = host(url);
  const [bad, setBad] = useState(false);
  if (!h || bad) return <span className="inline-flex shrink-0 items-center justify-center rounded-[4px] bg-hover text-faint" style={{ width: size, height: size }}><Newspaper style={{ width: size * 0.6, height: size * 0.6 }} /></span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`https://www.google.com/s2/favicons?domain=${h}&sz=64`} alt="" width={size} height={size} onError={() => setBad(true)} className="shrink-0 rounded-[4px]" style={{ width: size, height: size }} />;
}

type Askable = { title: string; url: string | null; summary: string };
const askPrompt = (i: Askable) => `From my farmOS reading list: "${i.title}"${i.url ? ` (${i.url})` : ""}.\n${i.summary}\n\nIs this worth my time? Check the source, tell me what to do next, and give the verdict line.`;

function AskAi({ item, className }: { item: Askable; className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/assistant?mode=research&q=${encodeURIComponent(askPrompt(item))}`); }}
      className={cn("inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[12px] leading-[1.35] text-muted transition-colors hover:bg-hover hover:text-ink", className)}
    >
      <Sparkles className="h-3.5 w-3.5 text-accent" /> Ask AI
    </button>
  );
}

function Brief({ day, category, onClose, from = "list", source }: { day: string; category: string; onClose: () => void; from?: "list" | "wire"; source?: string }) {
  const [text, setText] = useState("");
  const [state, setState] = useState<"loading" | "done" | "error">("loading");
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const r = await fetch("/api/feed/digest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ day, category, from, source }), signal: ctrl.signal });
        if (!r.ok || !r.body) {
          const j = (await r.json().catch(() => ({}))) as { error?: string };
          setText(j.error ?? `Request failed (${r.status})`);
          setState("error");
          return;
        }
        const reader = r.body.getReader();
        const dec = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          setText((t) => t + dec.decode(value, { stream: true }));
        }
        setState("done");
      } catch (e) {
        if ((e as Error).name !== "AbortError") { setText((e as Error).message); setState("error"); }
      }
    })();
    return () => ctrl.abort();
  }, [day, category, from, source]);
  return (
    <motion.div initial={{ opacity: 0, y: -6, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-5 overflow-hidden">
      <div className="rounded-xl border border-line bg-[color-mix(in_oklab,var(--accent-soft)_40%,var(--panel))] p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-accent-ink"><Sparkles className="h-3.5 w-3.5" /></span>
          <span className="text-[13.5px] font-medium">AI brief{category !== "all" && <span className="text-muted"> · {CATS.find((c) => c.id === category)?.label}</span>}</span>
          {state === "loading" && <Loader size={12} />}
          <button onClick={onClose} className="ml-auto rounded p-1 text-faint hover:bg-hover hover:text-ink" aria-label="Close brief"><X className="h-3.5 w-3.5" /></button>
        </div>
        {state === "error" ? (
          <p className="text-[13px] text-neg">{text}</p>
        ) : text ? (
          <div className="md text-[13.5px]"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: (p) => <a {...p} target="_blank" rel="noreferrer noopener" /> }}>{text}</ReactMarkdown></div>
        ) : (
          <div className="space-y-2"><Skeleton className="h-3 w-3/4" /><Skeleton className="h-3 w-2/3" /><Skeleton className="h-3 w-1/2" /></div>
        )}
      </div>
    </motion.div>
  );
}

function Reading() {
  const qc = useQueryClient();
  const ai = useAiConfig();
  const q = useQuery({ queryKey: ["feed"], queryFn: () => api<{ items: FeedItem[] }>("/api/feed") });
  const [busy, setBusy] = useState(false);
  const [cat, setCat] = useState("all");
  const [brief, setBrief] = useState(false);
  const [read, markRead] = useReadSet();
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
    return <EmptyState mark="feed" title="Point the research desk at a model first" body="The reading list is written by your AI endpoint from DefiLlama, CoinGecko, GeckoTerminal and 12 news and airdrop feeds. The News wire tab works without AI." action={<Link href="/settings#ai"><Button>Set up AI</Button></Link>} />;
  if (!shown.length)
    return <EmptyState mark="feed" title="No list for today yet" body="Generate one: the desk pulls fresh raises, trending tokens and new pools, then keeps only what links to a real source." action={<Button variant="primary" onClick={generate} disabled={busy}>{busy ? <Loader size={13} /> : <Sparkles className="h-3.5 w-3.5" />} Build today&apos;s list</Button>} />;
  const sorted = [...shown].sort((a, b) => b.score - a.score);
  const counts = Object.fromEntries(CATS.map((c) => [c.id, c.id === "all" ? sorted.length : sorted.filter((i) => (i.category ?? "news") === c.id).length]));
  const list = cat === "all" ? sorted : sorted.filter((i) => (i.category ?? "news") === cat);
  const [lead, ...rest] = list;
  const feature = rest.slice(0, 2);
  const more = rest.slice(2);
  const unread = sorted.filter((i) => !read.has(i.id)).length;
  const open = (i: FeedItem) => markRead(i.id);
  const day = shown[0].day;

  return (
    <MaybePull onRefresh={generate}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="text-[13px] text-muted">
          <span className="font-medium text-ink">{day === today ? "Today" : new Date(`${day}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
          <span className="mx-1.5 text-faint">·</span>{unread ? `${unread} unread` : "All read"}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant={brief ? "subtle" : "ghost"} onClick={() => setBrief((b) => !b)}><Sparkles className="h-3.5 w-3.5 text-accent" /> AI brief</Button>
          <Button size="sm" variant="ghost" onClick={generate} disabled={busy}>{busy ? <Loader size={12} /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh</Button>
        </div>
      </div>
      <div className="-mx-1 mb-5 flex gap-1 overflow-x-auto px-1 pb-1">
        {CATS.filter((c) => c.id === "all" || counts[c.id]).map((c) => (
          <button key={c.id} onClick={() => setCat(c.id)} className={cn("relative h-7 shrink-0 rounded-full border px-3 text-[12.5px] leading-[1.35] transition-colors", cat === c.id ? "border-transparent text-ink" : "border-line text-muted hover:text-ink")}>
            {cat === c.id && <motion.span layoutId="feed-cat" className="absolute inset-0 rounded-full bg-active" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            <span className="relative inline-flex items-center gap-1.5">
              {c.id !== "all" && <span className={cn("h-1.5 w-1.5 rounded-full", `dot-${CAT_TONE[c.id]}`)} />}
              {c.label}
            </span>
          </button>
        ))}
      </div>
      <AnimatePresence>{brief && <Brief key={`list-${cat}`} day={day} category={cat} onClose={() => setBrief(false)} />}</AnimatePresence>

      {lead && (
        <motion.a
          key={lead.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          href={lead.url ?? undefined}
          target="_blank"
          rel="noreferrer"
          onClick={() => open(lead)}
          className={cn("group relative block overflow-hidden rounded-2xl border border-line p-5 transition-colors hover:border-line-strong sm:p-6", read.has(lead.id) && "opacity-75")}
          style={{ background: `linear-gradient(135deg, var(--t-${CAT_TONE[lead.category ?? "news"] ?? "gray"}-bg) 0%, var(--panel) 62%)` }}
        >
          <div className="mb-3 flex items-center gap-2 text-[12px] text-muted">
            {lead.category && <Pill tone={CAT_TONE[lead.category] ?? "gray"}>{lead.category}</Pill>}
            <Favicon url={lead.url} />
            <span className="truncate">{lead.source ?? host(lead.url)}</span>
            <span className="ml-auto inline-flex items-center gap-1 font-label text-[10.5px] uppercase tracking-[0.14em] text-faint">Top pick</span>
          </div>
          <h3 className="max-w-3xl font-serif text-[26px] leading-[1.15] tracking-[-0.01em] text-ink sm:text-[30px]">{lead.title}</h3>
          <p className="mt-2.5 max-w-2xl text-[14px] leading-relaxed text-ink-2">{lead.summary}</p>
          <div className="mt-4 flex items-center gap-2">
            {lead.url && <span className="inline-flex items-center gap-1 text-[12.5px] font-medium text-accent">Read on {host(lead.url)} <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></span>}
            <AskAi item={lead} className="ml-auto bg-panel/70" />
          </div>
        </motion.a>
      )}

      {feature.length > 0 && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {feature.map((i, n) => (
            <motion.a
              key={i.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + n * 0.05 }}
              href={i.url ?? undefined}
              target="_blank"
              rel="noreferrer"
              onClick={() => open(i)}
              className={cn("group flex flex-col rounded-xl border border-line bg-panel p-4 transition-colors hover:border-line-strong", read.has(i.id) && "opacity-70")}
            >
              <div className="mb-2 flex items-center gap-2 text-[11.5px] text-muted">
                <span className={cn("h-1.5 w-1.5 rounded-full", `dot-${CAT_TONE[i.category ?? "news"] ?? "gray"}`)} />
                <span className="capitalize">{i.category ?? i.kind}</span>
                <span className="text-faint">·</span>
                <Favicon url={i.url} size={14} />
                <span className="truncate">{i.source ?? host(i.url)}</span>
              </div>
              <div className="font-serif text-[19px] leading-snug text-ink group-hover:underline group-hover:decoration-line-strong group-hover:underline-offset-4">{i.title}</div>
              <p className="mt-1.5 line-clamp-3 flex-1 text-[13px] leading-relaxed text-ink-2">{i.summary}</p>
              <div className="mt-3 flex justify-end"><AskAi item={i} /></div>
            </motion.a>
          ))}
        </div>
      )}

      {more.length > 0 && (
        <ul className="mt-5 divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
          {more.map((i, n) => (
            <motion.li key={i.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 + n * 0.03 }}>
              <a href={i.url ?? undefined} target="_blank" rel="noreferrer" onClick={() => open(i)} className={cn("group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-hover/60", read.has(i.id) && "opacity-65")}>
                <span className="mt-0.5"><Favicon url={i.url} size={18} /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-medium leading-snug text-ink">{i.title}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted">
                    <span className={cn("h-1.5 w-1.5 rounded-full", `dot-${CAT_TONE[i.category ?? "news"] ?? "gray"}`)} />
                    <span className="capitalize">{i.category ?? i.kind}</span>
                    <span className="text-faint">·</span>
                    <span className="truncate">{i.summary}</span>
                  </div>
                </div>
                <AskAi item={i} className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100" />
              </a>
            </motion.li>
          ))}
        </ul>
      )}
      {!lead && <div className="rounded-xl border border-dashed border-line py-10 text-center text-[13px] text-muted">Nothing in this category today.</div>}
    </MaybePull>
  );
}

const coarseQuery = "(pointer: coarse)";
const subscribeCoarse = (cb: () => void) => {
  const m = window.matchMedia(coarseQuery);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
/**
 * Pull-to-refresh only on touch screens. On desktop its pointer capture swallowed clicks on the
 * category chips and the AI brief button, so nothing filtered.
 */
function MaybePull({ onRefresh, children }: { onRefresh: () => Promise<void> | void; children: React.ReactNode }) {
  const coarse = useSyncExternalStore(subscribeCoarse, () => window.matchMedia(coarseQuery).matches, () => false);
  if (!coarse) return <div>{children}</div>;
  return <PullToRefresh onRefresh={async () => { await onRefresh(); }}>{children}</PullToRefresh>;
}

function XTimeline({ q }: { q: UseQueryResult<XFeed> }) {
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

type WireItem = { id: string; title: string; url: string; source: string; sourceId: string; site: string; publishedAt: string | null; summary: string; image: string | null; category: string };
type Wire = { fetchedAt: string; items: WireItem[]; failed: string[]; sources: { id: string; name: string; site: string }[] };

function ago(iso: string | null) {
  if (!iso) return "";
  const m = Math.max(0, Math.round((Date.now() - +new Date(iso)) / 60_000));
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}h` : `${Math.round(h / 24)}d`;
}

const X_KEY = "frioos-x-watch";
const X_DEFAULT = ["DefiLlama", "lookonchain", "TheBlock__", "WuBlockchain", "airdropalert_com", "CryptoRank_io", "opensea", "solana", "Aptos", "SuiNetwork"];

function XAvatar({ handle }: { handle: string }) {
  const [bad, setBad] = useState(false);
  if (bad) return <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-hover text-[11px] font-medium uppercase text-muted">{handle[0]}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/api/avatar/x/${handle}`} alt="" width={22} height={22} onError={() => setBad(true)} className="h-[22px] w-[22px] rounded-full bg-hover object-cover" />;
}

/** Free stand-in for the X timeline: quick links to accounts you watch (opens on X, nothing is read through the API). */
function XWatch() {
  const [list, setList] = useState<string[]>(() => {
    if (typeof window === "undefined") return X_DEFAULT;
    try {
      const v = JSON.parse(localStorage.getItem(X_KEY) ?? "null") as string[] | null;
      return Array.isArray(v) ? v : X_DEFAULT;
    } catch {
      return X_DEFAULT;
    }
  });
  const [adding, setAdding] = useState(false);
  const [val, setVal] = useState("");
  const save = (l: string[]) => { setList(l); localStorage.setItem(X_KEY, JSON.stringify(l)); };
  const add = () => {
    const h = val.trim().replace(/^@/, "").replace(/^https?:\/\/(x|twitter)\.com\//i, "").split(/[/?]/)[0];
    if (/^\w{1,15}$/.test(h) && !list.some((x) => x.toLowerCase() === h.toLowerCase())) save([...list, h]);
    setVal("");
    setAdding(false);
  };
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center gap-1.5 text-[12px] text-muted"><BrandIcon id="x" size={12} /> Accounts you watch</div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {list.map((h) => (
          <span key={h} className="group relative flex h-8 shrink-0 items-center rounded-full border border-line bg-panel text-[12.5px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink">
            <a href={`https://x.com/${h}`} target="_blank" rel="noreferrer" className="flex h-full items-center gap-1.5 pl-1 pr-2.5">
              <XAvatar handle={h} />
              @{h}
            </a>
            <button type="button" aria-label={`Remove @${h}`} onClick={() => save(list.filter((x) => x !== h))} className="-ml-1.5 mr-1.5 hidden rounded-full p-0.5 text-faint hover:text-ink group-hover:block"><X className="h-3 w-3" /></button>
          </span>
        ))}
        {adding ? (
          <input autoFocus value={val} onChange={(e) => setVal(e.target.value)} onBlur={add} onKeyDown={(e) => { if (e.key === "Enter") add(); if (e.key === "Escape") { setVal(""); setAdding(false); } }} placeholder="@handle" className="h-8 w-32 shrink-0 rounded-full border border-line bg-panel px-3 text-[12.5px] outline-none focus:ring-2 focus:ring-[var(--ring)]" />
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="flex h-8 shrink-0 items-center gap-1 rounded-full border border-dashed border-line px-2.5 text-[12.5px] text-muted hover:text-ink"><Plus className="h-3.5 w-3.5" /> Add</button>
        )}
      </div>
    </div>
  );
}

function NewsWire() {
  const qc = useQueryClient();
  const ai = useAiConfig();
  const q = useQuery({ queryKey: ["news-wire"], queryFn: () => api<Wire>("/api/feed/news"), staleTime: 5 * 60_000 });
  const [cat, setCat] = useState("all");
  const [src, setSrc] = useState("all");
  const [brief, setBrief] = useState(false);
  const [limit, setLimit] = useState(30);
  const [busy, setBusy] = useState(false);
  const [read, markRead] = useReadSet();
  const refresh = async () => {
    setBusy(true);
    try {
      qc.setQueryData(["news-wire"], await api<Wire>("/api/feed/news", { method: "POST" }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (q.isLoading) return <div className="space-y-3"><Skeleton className="h-10" /><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>;
  if (q.isError || !q.data) return <EmptyState mark="feed" title="The wire didn't load" body={(q.error as Error | null)?.message} action={<Button onClick={() => q.refetch()}>Try again</Button>} />;
  const all = q.data.items;
  const bySrc = src === "all" ? all : all.filter((i) => i.sourceId === src);
  const counts = Object.fromEntries(CATS.map((c) => [c.id, c.id === "all" ? bySrc.length : bySrc.filter((i) => i.category === c.id).length]));
  const list = cat === "all" ? bySrc : bySrc.filter((i) => i.category === cat);
  const srcOpts = [{ id: "all", label: `All sources (${q.data.sources.length})` }, ...q.data.sources.filter((s) => all.some((i) => i.sourceId === s.id)).map((s) => ({ id: s.id, label: s.name }))];
  return (
    <MaybePull onRefresh={refresh}>
      <XWatch />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="text-[13px] text-muted"><span className="font-medium text-ink">{list.length} headlines</span><span className="mx-1.5 text-faint">·</span>updated {ago(q.data.fetchedAt)} ago</div>
        <div className="ml-auto flex items-center gap-1">
          <NativeSelect variant="ghost" value={src} onChange={(v) => { setSrc(v); setLimit(30); }} options={srcOpts} align="end" width={220} ariaLabel="Source" />
          {ai.data?.configured && <Button size="sm" variant={brief ? "subtle" : "ghost"} onClick={() => setBrief((b) => !b)}><Sparkles className="h-3.5 w-3.5 text-accent" /> AI brief</Button>}
          <Button size="sm" variant="ghost" onClick={refresh} disabled={busy}>{busy ? <Loader size={12} /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh</Button>
        </div>
      </div>
      <div className="-mx-1 mb-5 flex gap-1 overflow-x-auto px-1 pb-1">
        {CATS.filter((c) => c.id === "all" || counts[c.id]).map((c) => (
          <button key={c.id} onClick={() => { setCat(c.id); setLimit(30); }} className={cn("relative h-7 shrink-0 rounded-full border px-3 text-[12.5px] leading-[1.35] transition-colors", cat === c.id ? "border-transparent text-ink" : "border-line text-muted hover:text-ink")}>
            {cat === c.id && <motion.span layoutId="wire-cat" className="absolute inset-0 rounded-full bg-active" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            <span className="relative inline-flex items-center gap-1.5">
              {c.id !== "all" && <span className={cn("h-1.5 w-1.5 rounded-full", `dot-${CAT_TONE[c.id]}`)} />}
              {c.label}
              <span className="num text-faint">{counts[c.id]}</span>
            </span>
          </button>
        ))}
      </div>
      <AnimatePresence>{brief && <Brief key={`wire-${cat}-${src}`} day="" category={cat} from="wire" source={src} onClose={() => setBrief(false)} />}</AnimatePresence>
      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line py-10 text-center text-[13px] text-muted">No headlines here right now.</div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
          {list.slice(0, limit).map((i) => (
            <li key={i.id}>
              <a href={i.url} target="_blank" rel="noreferrer" onClick={() => markRead(i.id)} className={cn("group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-hover/60", read.has(i.id) && "opacity-65")}>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-1.5 text-[11.5px] text-muted">
                    <Favicon url={i.url} size={14} />
                    <span className="truncate font-medium text-ink-2">{i.source}</span>
                    {i.publishedAt && <><span className="text-faint">·</span><span className="num shrink-0">{ago(i.publishedAt)}</span></>}
                    {i.category !== "news" && <Pill tone={CAT_TONE[i.category] ?? "gray"} className="ml-1 min-h-[18px] text-[11px]">{i.category}</Pill>}
                  </div>
                  <div className="text-[14px] font-medium leading-snug text-ink group-hover:underline group-hover:decoration-line-strong group-hover:underline-offset-4">{i.title}</div>
                  {i.summary && <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-relaxed text-muted">{i.summary}</p>}
                </div>
                {i.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.image} alt="" loading="lazy" className="hidden h-16 w-24 shrink-0 rounded-md border border-line object-cover sm:block" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                )}
                {ai.data?.configured && <AskAi item={i} className="self-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100" />}
              </a>
            </li>
          ))}
        </ul>
      )}
      {list.length > limit && <div className="mt-3 flex justify-center"><Button size="sm" variant="ghost" onClick={() => setLimit((l) => l + 30)}>Show more ({list.length - limit})</Button></div>}
    </MaybePull>
  );
}
