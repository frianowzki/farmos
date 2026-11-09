"use client";
import { useChat } from "@ai-sdk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowUp, Check, ChevronRight, History, Loader2, MessageSquarePlus, Plus, ScanSearch, Sparkles, Square, Telescope, Trash2, Wrench, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Monogram } from "@/components/shell";
import { Button, NativeSelect, Pill } from "@/components/ui";
import { cn } from "@/lib/cn";
import { api, keys, useAiConfig, useCreateProject, useProjects } from "@/lib/client/api";

const MODES = [
  { id: "chat", label: "Chat", icon: MessageSquarePlus, desc: "Ask anything. Crypto-native, direct, cites sources." },
  { id: "research", label: "Deep research", icon: Telescope, desc: "Team, raise, traction, token status, how to farm it, key dates, verdict." },
  { id: "audit", label: "Audit", icon: ScanSearch, desc: "Links, contracts, deposit requirements, red flags and a risk score." },
  { id: "daily", label: "Daily picks", icon: Zap, desc: "Today's most promising opportunities, minus what you already track." },
  { id: "early", label: "Early", icon: Sparkles, desc: "Pre-token protocols, fresh raises, new testnets and pools." },
];

const SUGGEST: Record<string, (p?: string) => string[]> = {
  chat: () => ["What should I prioritise this week based on my projects?", "Explain how sybil filters usually work for points programs.", "Compare the cost of farming on Base vs Arbitrum right now."],
  research: (p) => (p ? [`Deep research on ${p}. What's the latest, and is it still worth farming?`] : ["Deep research on Monad: ecosystem, airdrop expectations, what to do now.", "Research the top 5 points programs without a token yet."]),
  audit: (p) => (p ? [`Audit ${p}. Check the contracts and links, and give me a verdict.`] : ["Audit this contract on Base: 0x…", "Audit this mint site before I connect: https://…"]),
  daily: () => ["What are today's most promising projects for me?", "Give me 5 low-cost testnets worth doing today."],
  early: () => ["Find early projects that raised in the last 30 days with no token.", "What new pools on Base have real liquidity today?"],
};

function newId() {
  return crypto.randomUUID().replace(/-/g, "");
}

export function AssistantView() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const threadParam = sp.get("t");
  const [localId, setLocalId] = useState(() => newId());
  const threadId = threadParam ?? localId;
  const [historyOpen, setHistoryOpen] = useState(false);

  const thread = useQuery({
    queryKey: ["thread", threadId],
    queryFn: () => api<{ thread: { id: string; mode: string; messages: UIMessage[] } | null }>(`/api/threads/${threadId}`),
    enabled: Boolean(threadParam),
    staleTime: Infinity,
  });

  const start = (id = newId()) => {
    setLocalId(id);
    const p = new URLSearchParams(sp.toString());
    p.delete("t");
    router.replace(`${pathname}${p.toString() ? `?${p}` : ""}`, { scroll: false });
  };

  const ready = !threadParam || thread.isFetched;
  return (
    <div className="flex h-[calc(100dvh-48px)] md:h-dvh">
      <Threads current={threadId} open={historyOpen} onClose={() => setHistoryOpen(false)} onNew={() => start()} />
      <div className="flex min-w-0 flex-1 flex-col">
        {ready ? (
          <Chat
            key={threadId}
            id={threadId}
            initialMessages={thread.data?.thread?.messages ?? []}
            initialMode={thread.data?.thread?.mode ?? sp.get("mode") ?? "chat"}
            initialProject={sp.get("project") ?? ""}
            onHistory={() => setHistoryOpen(true)}
            onNew={() => start()}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted"><Loader2 className="h-4 w-4 animate-spin" /></div>
        )}
      </div>
    </div>
  );
}

function Threads({ current, open, onClose, onNew }: { current: string; open: boolean; onClose: () => void; onNew: () => void }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: keys.threads, queryFn: () => api<{ threads: { id: string; title: string; mode: string; updatedAt: string }[] }>("/api/threads") });
  const list = data?.threads ?? [];
  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/20 lg:hidden" onClick={onClose} />}
      <aside className={cn("z-50 w-[260px] shrink-0 flex-col border-r border-line bg-sidebar", open ? "fixed inset-y-0 left-0 flex lg:static" : "hidden lg:flex")}>
        <div className="flex items-center justify-between px-3 py-3">
          <span className="text-[12px] font-medium text-muted">Threads</span>
          <Button size="sm" variant="ghost" onClick={() => { onNew(); onClose(); }}><Plus className="h-3.5 w-3.5" /> New</Button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {list.length === 0 && <div className="px-2 py-4 text-[12.5px] text-faint">Saved conversations appear here.</div>}
          {list.map((t) => (
            <div key={t.id} className={cn("group flex items-center rounded-md hover:bg-hover", t.id === current && "bg-active")}>
              <Link href={`/assistant?t=${t.id}`} onClick={onClose} className="min-w-0 flex-1 px-2 py-1.5">
                <div className="truncate text-[13px] text-ink-2">{t.title}</div>
                <div className="text-[11px] capitalize text-faint">{MODES.find((m) => m.id === t.mode)?.label ?? t.mode} · {new Date(t.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
              </Link>
              <button
                onClick={async () => { await api(`/api/threads/${t.id}`, { method: "DELETE" }); qc.invalidateQueries({ queryKey: keys.threads }); if (t.id === current) onNew(); }}
                className="mr-1 rounded p-1 text-faint opacity-0 hover:text-neg group-hover:opacity-100"
                aria-label="Delete thread"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}

function Chat({ id, initialMessages, initialMode, initialProject, onHistory, onNew }: { id: string; initialMessages: UIMessage[]; initialMode: string; initialProject: string; onHistory: () => void; onNew: () => void }) {
  const qc = useQueryClient();
  const ai = useAiConfig();
  const { data: pd } = useProjects();
  const [mode, setMode] = useState(MODES.some((m) => m.id === initialMode) ? initialMode : "chat");
  const [projectId, setProjectId] = useState(initialProject);
  const ctx = useRef({ mode, projectId });
  useEffect(() => {
    ctx.current = { mode, projectId };
  }, [mode, projectId]);
  const projectName = pd?.projects.find((p) => p.id === projectId)?.name;
  const [input, setInput] = useState("");

  const transport = useMemo(
    // ctx is read lazily inside the request callback, never during render
    // eslint-disable-next-line react-hooks/refs
    () => new DefaultChatTransport({ api: "/api/chat", prepareSendMessagesRequest: ({ messages, id }) => ({ body: { id, messages, mode: ctx.current.mode, projectId: ctx.current.projectId || null } }) }),
    [],
  );
  const { messages, sendMessage, status, stop, error } = useChat({
    id,
    messages: initialMessages,
    transport,
    onFinish: () => qc.invalidateQueries({ queryKey: keys.threads }),
  });
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);
  const busy = status === "submitted" || status === "streaming";
  const send = (text: string) => {
    if (!text.trim() || busy) return;
    sendMessage({ text: text.trim() });
    setInput("");
  };
  const m = MODES.find((x) => x.id === mode)!;
  const notConfigured = ai.data && !ai.data.configured;

  return (
    <>
      <div className="flex items-center gap-2 border-b border-line px-3 py-2 sm:px-5">
        <button onClick={onHistory} className="rounded-md p-1.5 text-muted hover:bg-hover lg:hidden" aria-label="Threads"><History className="h-4 w-4" /></button>
        <div className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto">
          {MODES.map((x) => (
            <button key={x.id} onClick={() => setMode(x.id)} className={cn("flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] transition-colors", mode === x.id ? "bg-active text-ink" : "text-muted hover:bg-hover hover:text-ink")}>
              <x.icon className="h-3.5 w-3.5" /> {x.label}
            </button>
          ))}
        </div>
        <NativeSelect value={projectId} onChange={setProjectId} options={[{ id: "", label: "No project context" }, ...(pd?.projects ?? []).map((p) => ({ id: p.id, label: p.name }))]} className="hidden w-[190px] sm:block" />
        <Button size="sm" variant="ghost" onClick={onNew} className="hidden lg:inline-flex"><Plus className="h-3.5 w-3.5" /> New</Button>
      </div>

      <div ref={scroller} className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[760px] px-4 py-8 sm:px-6">
          {messages.length === 0 ? (
            <div className="anim-rise pt-[6vh]">
              <div className="mb-1 flex items-center gap-2 text-[12px] font-medium text-muted"><m.icon className="h-3.5 w-3.5" /> {m.label}</div>
              <h1 className="font-serif text-[32px] leading-tight tracking-[-0.015em]">{projectName && (mode === "research" || mode === "audit") ? <>{m.label} <span className="italic">{projectName}</span></> : "What are we digging into?"}</h1>
              <p className="mt-2 max-w-lg text-[14px] text-muted">{m.desc}</p>
              {notConfigured && (
                <div className="mt-5 rounded-lg border border-line bg-panel p-3 text-[13px] text-ink-2">
                  Connect your model first: <Link href="/settings#ai" className="text-accent underline underline-offset-2">Settings → Research desk</Link>. Any OpenAI-compatible endpoint works (DeepSeek included).
                </div>
              )}
              <div className="mt-6 space-y-1.5">
                {SUGGEST[mode](projectName).map((s) => (
                  <button key={s} onClick={() => setInput(s)} className="flex w-full items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2.5 text-left text-[13.5px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink">
                    <ChevronRight className="h-3.5 w-3.5 text-faint" /> {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((msg) => <Message key={msg.id} msg={msg} />)}
              {status === "submitted" && <div className="flex items-center gap-2 text-[13px] text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…</div>}
              {error && <div className="rounded-lg border border-line bg-panel p-3 text-[13px] text-neg">{error.message}</div>}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-line bg-bg px-3 pb-3 pt-2 sm:px-6">
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="mx-auto flex max-w-[760px] items-end gap-2 rounded-xl border border-line bg-panel p-2 shadow-pop focus-within:border-line-strong">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={Math.min(8, Math.max(1, input.split("\n").length))}
            placeholder={mode === "audit" ? "Paste a project, site, or contract address + chain…" : "Ask in English or Bahasa…"}
            className="max-h-[200px] min-h-[36px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[14.5px] outline-none placeholder:text-faint"
          />
          {busy ? (
            <Button type="button" size="icon" variant="subtle" onClick={() => stop()} aria-label="Stop" className="h-8 w-8"><Square className="h-3.5 w-3.5" /></Button>
          ) : (
            <Button type="submit" size="icon" variant="primary" disabled={!input.trim() || Boolean(notConfigured)} aria-label="Send" className="h-8 w-8"><ArrowUp className="h-4 w-4" /></Button>
          )}
        </form>
        <p className="mx-auto mt-1.5 max-w-[760px] text-center text-[11px] text-faint">Research only. Never shares keys, never sends transactions. Verify before you ape.</p>
      </div>
    </>
  );
}

const TOOL_LABEL: Record<string, string> = {
  fetchUrl: "Read page",
  defillamaProtocols: "DefiLlama",
  defillamaRaises: "Raises",
  dexscreener: "DexScreener",
  geckoTerminal: "GeckoTerminal",
  coingeckoTrending: "CoinGecko trending",
  contractCheck: "Contract check",
  listProjects: "Your projects",
  getProject: "Project",
  proposeProject: "Proposal",
};

type ToolPart = { type: string; toolCallId: string; state: string; input?: Record<string, unknown>; output?: unknown; errorText?: string; toolName?: string };

function Message({ msg }: { msg: UIMessage }) {
  if (msg.role === "user") {
    const text = msg.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-hover px-3.5 py-2 text-[14.5px]">{text}</div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {msg.parts.map((part, i) => {
        if (part.type === "text") return <div key={i} className="md"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: (p) => <a {...p} target="_blank" rel="noreferrer noopener" /> }}>{part.text}</ReactMarkdown></div>;
        if (part.type === "reasoning") return part.text ? <details key={i} className="text-[12.5px] text-muted"><summary className="cursor-pointer select-none">Reasoning</summary><div className="mt-1 whitespace-pre-wrap border-l border-line pl-3">{part.text}</div></details> : null;
        if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
          const tp = part as unknown as ToolPart;
          const name = tp.toolName ?? part.type.replace(/^tool-/, "");
          if (name === "proposeProject" && tp.state === "output-available") return <Proposal key={i} output={tp.output as { proposal: ProposalT }} />;
          return <ToolChip key={i} name={name} part={tp} />;
        }
        return null;
      })}
    </div>
  );
}

function ToolChip({ name, part }: { name: string; part: ToolPart }) {
  const [open, setOpen] = useState(false);
  const running = part.state === "input-streaming" || part.state === "input-available";
  const failed = part.state === "output-error" || (part.output && typeof part.output === "object" && "error" in (part.output as object));
  const arg = part.input ? String(part.input.query ?? part.input.url ?? part.input.address ?? part.input.name ?? part.input.kind ?? "") : "";
  return (
    <div className="text-[12.5px]">
      <button onClick={() => setOpen((o) => !o)} className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-line bg-panel px-2 py-1 text-muted hover:text-ink">
        {running ? <Loader2 className="h-3 w-3 animate-spin" /> : failed ? <Wrench className="h-3 w-3 text-neg" /> : <Check className="h-3 w-3 text-pos" />}
        <span className="font-medium text-ink-2">{TOOL_LABEL[name] ?? name}</span>
        {arg && <span className="num truncate text-faint">{arg.slice(0, 70)}</span>}
      </button>
      {open && <pre className="num mt-1 max-h-[260px] overflow-auto rounded-md border border-line bg-sidebar p-2 text-[11px] text-ink-2">{JSON.stringify(part.output ?? part.input ?? part.errorText, null, 2)?.slice(0, 8000)}</pre>}
    </div>
  );
}

type ProposalT = { name: string; category: string; summary: string; chains?: string[]; tier?: string; risk?: string; tags?: string[]; links?: Record<string, string>; source?: string; deadline?: string };

function Proposal({ output }: { output: { proposal: ProposalT } }) {
  const p = output?.proposal;
  const create = useCreateProject();
  const { data } = useProjects();
  const [created, setCreated] = useState<string | null>(null);
  if (!p) return null;
  const exists = data?.projects.find((x) => x.name.toLowerCase() === p.name.toLowerCase());
  const add = async () => {
    try {
      const { project } = await create.mutateAsync({
        name: p.name, category: p.category, summary: p.summary, chains: p.chains ?? [], tier: p.tier ?? "B", risk: p.risk ?? "medium", tags: p.tags ?? [],
        links: Object.fromEntries(Object.entries(p.links ?? {}).filter(([, v]) => v)), source: p.source ?? "Research desk", status: "research",
        deadline: p.deadline && /^\d{4}-\d{2}-\d{2}$/.test(p.deadline) ? p.deadline : null,
      });
      setCreated(project.id);
      toast.success(`Added ${p.name}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <div className="rounded-xl border border-line bg-panel p-3.5">
      <div className="flex items-start gap-3">
        <Monogram name={p.name} size={28} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[14px] font-medium">{p.name}</span>
            <Pill tone="stone">{p.category}</Pill>
            {p.tier && <Pill tone="amber">Tier {p.tier}</Pill>}
            {p.risk && <Pill tone={p.risk === "low" ? "green" : p.risk === "medium" ? "amber" : "red"}>{p.risk} risk</Pill>}
          </div>
          <p className="mt-1 text-[13px] text-ink-2">{p.summary}</p>
          {p.chains?.length ? <div className="mt-1 text-[12px] text-muted">{p.chains.join(" · ")}</div> : null}
        </div>
        {created || exists ? (
          <Link href={`/projects/${created ?? exists!.id}`}><Button size="sm">{created ? "Open" : "In frioOS"} <ChevronRight className="h-3.5 w-3.5" /></Button></Link>
        ) : (
          <Button size="sm" variant="primary" onClick={add} disabled={create.isPending}><Plus className="h-3.5 w-3.5" /> Add to frioOS</Button>
        )}
      </div>
    </div>
  );
}
