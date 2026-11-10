"use client";
import { ProjectMark } from "@/components/project-mark";
import { useChat } from "@ai-sdk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowUp, Check, ChevronRight, Copy, History, Loader2, MessageSquarePlus, PanelRightClose, Plus, ScanSearch, Sparkles, Square, Telescope, Trash2, Wrench, Zap } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "@/lib/client/toast";

import { Button, Dialog, NativeSelect, Pill } from "@/components/ui";
import { cn } from "@/lib/cn";
import { api, keys, useAiConfig, useCreateProject, useProjects, type Project } from "@/lib/client/api";

const MODES = [
  { id: "chat", label: "Chat", icon: MessageSquarePlus, desc: "Ask anything. Crypto-native, direct, cites sources." },
  { id: "research", label: "Deep research", icon: Telescope, desc: "Team, raise, traction, token status, how to farm it, key dates, verdict." },
  { id: "audit", label: "Audit", icon: ScanSearch, desc: "Links, contracts, deposit requirements, red flags and a risk score." },
  { id: "daily", label: "Daily picks", icon: Zap, desc: "Today's most promising opportunities, minus what you already track." },
  { id: "early", label: "Early", icon: Sparkles, desc: "Pre-token protocols, fresh raises, new testnets and pools." },
];

const SUGGEST: Record<string, (p?: string) => string[]> = {
  chat: () => ["What's claimable or closing in the next 2 weeks?", "Which of my projects has the best ROI after gas?", "Summarize today's news that mentions my projects.", "Suggest new projects or mints from the wire that I'm not tracking yet."],
  research: (p) => (p ? [`Deep research on ${p}. What's the latest, and is it still worth farming?`] : ["Deep research on Monad: ecosystem, airdrop expectations, what to do now.", "Research the top 5 points programs without a token yet."]),
  audit: (p) => (p ? [`Audit ${p}. Check the contracts and links, and give me a verdict.`] : ["Audit this contract on Base: 0x…", "Audit this mint site before I connect: https://…"]),
  daily: () => ["Plan my day: today's tasks, dates coming up, and anything to claim.", "What are today's most promising projects for me?", "Any upcoming mints I'm eligible for this week?"],
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
    <div className="flex h-[calc(100dvh-48px-env(safe-area-inset-top))] md:h-dvh">
      <div className="flex min-w-0 flex-1 flex-col">
        {ready ? (
          <Chat
            key={threadId}
            id={threadId}
            initialMessages={thread.data?.thread?.messages ?? []}
            initialMode={thread.data?.thread?.mode ?? sp.get("mode") ?? "chat"}
            initialProject={sp.get("project") ?? ""}
            initialQuery={threadParam ? undefined : sp.get("q") ?? undefined}
            onHistory={() => setHistoryOpen((o) => !o)}
            historyOpen={historyOpen}
            onNew={() => start()}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted"><Loader2 className="h-4 w-4 animate-spin" /></div>
        )}
      </div>
      {/* Threads live on the right and stay hidden until toggled; picking one hides them again. */}
      <Threads current={threadId} open={historyOpen} onClose={() => setHistoryOpen(false)} onNew={() => start()} />
    </div>
  );
}

function Threads({ current, open, onClose, onNew }: { current: string; open: boolean; onClose: () => void; onNew: () => void }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: keys.threads, queryFn: () => api<{ threads: { id: string; title: string; mode: string; updatedAt: string }[] }>("/api/threads") });
  const list = data?.threads ?? [];
  const [confirm, setConfirm] = useState<{ id: string; title: string } | "all" | null>(null);
  const [busy, setBusy] = useState(false);
  const doDelete = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm === "all") {
        await api("/api/threads", { method: "DELETE" });
        qc.removeQueries({ queryKey: ["thread"] });
        onNew();
        toast.success("History cleared");
      } else {
        await api(`/api/threads/${confirm.id}`, { method: "DELETE" });
        qc.removeQueries({ queryKey: ["thread", confirm.id] });
        if (confirm.id === current) onNew();
        toast.success("Thread deleted");
      }
      qc.invalidateQueries({ queryKey: keys.threads });
      setConfirm(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!open || confirm) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose, confirm]);
  return (
    <>
    <AnimatePresence initial={false}>
      {open && <motion.div key="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/20 lg:hidden" onClick={onClose} />}
      {open && (
      <motion.aside
        key="threads"
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: 272, opacity: 1 }}
        exit={{ width: 0, opacity: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 40 }}
        className="fixed inset-y-0 right-0 z-50 flex shrink-0 flex-col overflow-hidden border-l border-line bg-sidebar pt-[env(safe-area-inset-top)] lg:static lg:z-auto lg:pt-0"
      >
        <div className="flex w-[272px] items-center justify-between gap-1 px-3 py-3">
          <span className="text-[12px] font-medium text-muted">Threads</span>
          <div className="flex items-center gap-0.5">
            <Button size="sm" variant="ghost" onClick={() => { onNew(); onClose(); }}><Plus className="h-3.5 w-3.5" /> New</Button>
            <button type="button" onClick={onClose} className="rounded-md p-1.5 text-faint hover:bg-hover hover:text-ink" aria-label="Hide threads"><PanelRightClose className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="w-[272px] flex-1 overflow-y-auto px-2 pb-3">
          {list.length === 0 && <div className="px-2 py-4 text-[12.5px] text-faint">Saved conversations appear here.</div>}
          {list.map((t) => (
            <div key={t.id} className={cn("group flex items-center rounded-md hover:bg-hover", t.id === current && "bg-active")}>
              <Link href={`/assistant?t=${t.id}`} onClick={onClose} className="min-w-0 flex-1 px-2 py-1.5">
                <div className="truncate text-[13px] text-ink-2">{t.title}</div>
                <div className="text-[11px] capitalize text-faint">{MODES.find((m) => m.id === t.mode)?.label ?? t.mode} · {new Date(t.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
              </Link>
              {/* Always visible on touch screens; hover-reveal only where there is a mouse. */}
              <button
                type="button"
                onClick={() => setConfirm({ id: t.id, title: t.title })}
                className="mr-1 grid h-9 w-9 shrink-0 place-items-center rounded-md text-faint hover:bg-active hover:text-neg focus-visible:opacity-100 [@media(hover:hover)]:h-7 [@media(hover:hover)]:w-7 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
                aria-label={`Delete thread “${t.title}”`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        {list.length > 0 && (
          <div className="w-[272px] border-t border-line px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <Button size="sm" variant="danger" className="h-9 w-full justify-start sm:h-8" onClick={() => setConfirm("all")}>
              <Trash2 className="h-3.5 w-3.5" /> Clear all history
            </Button>
          </div>
        )}
      </motion.aside>
      )}
    </AnimatePresence>
    <Dialog open={Boolean(confirm)} onClose={() => !busy && setConfirm(null)} title={confirm === "all" ? "Clear all history?" : "Delete thread?"} width={420}>
      <p className="text-[13.5px] text-ink-2">
        {confirm === "all" ? `All ${list.length} saved conversation${list.length === 1 ? "" : "s"} will be deleted. This can't be undone.` : <>“<span className="font-medium text-ink">{confirm?.title}</span>” will be deleted. This can&apos;t be undone.</>}
      </p>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button className="h-10 sm:h-8" onClick={() => setConfirm(null)} disabled={busy}>Cancel</Button>
        <Button variant="primary" className="h-10 bg-neg hover:not-disabled:bg-neg/90 sm:h-8" onClick={doDelete} disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} {confirm === "all" ? "Clear all" : "Delete"}
        </Button>
      </div>
    </Dialog>
    </>
  );
}

const MODE_SUGGEST_ICON: Record<string, typeof Telescope> = { chat: MessageSquarePlus, research: Telescope, audit: ScanSearch, daily: Zap, early: Sparkles };

function Composer({
  input, setInput, onSend, busy, onStop, mode, setMode, disabled, projectId, setProjectId, projects, autoFocus, big,
}: {
  input: string; setInput: (v: string) => void; onSend: () => void; busy: boolean; onStop: () => void; mode: string; setMode: (m: string) => void; disabled: boolean;
  projectId: string; setProjectId: (v: string) => void; projects: Project[]; autoFocus?: boolean; big?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [input]);
  useEffect(() => {
    if (autoFocus && window.matchMedia("(hover: hover)").matches) ref.current?.focus();
  }, [autoFocus]);
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSend(); }}
      className={cn("group/composer rounded-2xl border border-line bg-panel shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-16px_rgba(0,0,0,0.25)] transition-colors focus-within:border-line-strong", big && "rounded-[20px]")}
    >
      <textarea
        ref={ref}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onSend();
          }
        }}
        rows={big ? 2 : 1}
        placeholder={mode === "audit" ? "Paste a project, site, or contract address + chain…" : mode === "research" ? "Which project should I research?" : "Ask anything, In English, Bahasa or Tagalog..."}
        className={cn("block w-full resize-none bg-transparent px-4 pt-3.5 text-[15px] leading-[1.5] outline-none placeholder:text-faint", big ? "min-h-[64px]" : "min-h-[44px]")}
      />
      <div className="flex items-center gap-1 px-2 pb-2 pt-1">
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto pr-6 [scrollbar-width:none] [mask-image:linear-gradient(to_right,black_80%,transparent)] sm:[mask-image:none]">
          {MODES.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setMode(x.id)}
              title={x.desc}
              className={cn("relative flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] leading-[1.35] transition-colors", mode === x.id ? "text-ink" : "text-muted hover:text-ink")}
            >
              {mode === x.id && <motion.span layoutId="mode-pill" className="absolute inset-0 rounded-full bg-active" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
              <x.icon className="relative h-3.5 w-3.5" />
              <span className="relative">{x.label}</span>
            </button>
          ))}
        </div>
        <NativeSelect
          variant="ghost"
          ariaLabel="Project context"
          value={projectId}
          onChange={setProjectId}
          options={[{ id: "", label: "No project", media: <span className="h-4 w-4 shrink-0 rounded-[4px] border border-dashed border-line" /> }, ...projects.map((p) => ({ id: p.id, label: p.name, media: <ProjectMark p={p} size={16} className="rounded-[4px]" /> }))]}
          align="end"
          width={240}
          className="hidden max-w-[170px] shrink-0 sm:inline-flex [&>button]:h-7 [&>button]:rounded-full [&>button]:text-[12px]"
        />
        {busy ? (
          <button type="button" onClick={onStop} aria-label="Stop" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-bg transition-transform active:scale-95"><Square className="h-3 w-3 fill-current" /></button>
        ) : (
          <button type="submit" disabled={!input.trim() || disabled} aria-label="Send" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink transition-all active:scale-95 disabled:opacity-35"><ArrowUp className="h-4 w-4" strokeWidth={2.25} /></button>
        )}
      </div>
    </form>
  );
}

function DeskAvatar({ pulse }: { pulse?: boolean }) {
  return (
    <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-ink">
      <Sparkles className="h-3.5 w-3.5" />
      {pulse && <motion.span className="absolute inset-0 rounded-lg bg-accent" animate={{ opacity: [0.5, 0], scale: [1, 1.5] }} transition={{ duration: 1.2, repeat: Infinity }} />}
    </span>
  );
}

function Chat({ id, initialMessages, initialMode, initialProject, initialQuery, onHistory, historyOpen, onNew }: { id: string; initialMessages: UIMessage[]; initialMode: string; initialProject: string; initialQuery?: string; onHistory: () => void; historyOpen: boolean; onNew: () => void }) {
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
  const [input, setInput] = useState(initialQuery ?? "");

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
  const notConfigured = Boolean(ai.data && !ai.data.configured);
  const send = (text: string) => {
    if (!text.trim() || busy || notConfigured) return;
    sendMessage({ text: text.trim() });
    setInput("");
  };
  // Deep link from Feed / project pages: ?q=… sends once the model config is known.
  const sentQuery = useRef(false);
  useEffect(() => {
    if (!initialQuery || sentQuery.current || !ai.data || initialMessages.length) return;
    sentQuery.current = true;
    const u = new URL(window.location.href);
    u.searchParams.delete("q");
    window.history.replaceState(null, "", u.pathname + u.search);
    if (ai.data.configured) {
      sendMessage({ text: initialQuery });
      setTimeout(() => setInput(""), 0);
    }
  }, [initialQuery, ai.data, initialMessages.length, sendMessage]);

  const m = MODES.find((x) => x.id === mode)!;
  const projects = pd?.projects ?? [];
  const composer = (big?: boolean) => (
    <Composer input={input} setInput={setInput} onSend={() => send(input)} busy={busy} onStop={stop} mode={mode} setMode={setMode} disabled={notConfigured} projectId={projectId} setProjectId={setProjectId} projects={projects} autoFocus big={big} />
  );
  const empty = messages.length === 0;
  const firstUser = messages.find((x) => x.role === "user");
  const title = firstUser ? firstUser.parts.map((p) => (p.type === "text" ? p.text : "")).join("").slice(0, 80) : "New chat";

  return (
    <>
      <div className="flex h-12 items-center gap-2 px-3 sm:px-5">
        <div className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink-2">{empty ? "" : title}</div>
        {projectName && <Pill tone="stone"><ProjectMark p={pd!.projects.find((p) => p.id === projectId)!} size={14} /> {projectName}</Pill>}
        <Button size="sm" variant="ghost" onClick={onNew}><Plus className="h-3.5 w-3.5" /> New chat</Button>
        <Button size="sm" variant={historyOpen ? "subtle" : "ghost"} onClick={onHistory} aria-label={historyOpen ? "Hide threads" : "Show threads"} aria-expanded={historyOpen}><History className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Threads</span></Button>
      </div>

      {empty ? (
        <>
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }} className="w-full max-w-[720px] py-6">
              <div className="flex flex-col items-center text-center">
                <motion.div
                  className="mb-4 flex h-14 w-14 items-center justify-center"
                  animate={{ rotate: [0, 4, -4, 0], y: [0, -2, 0] }}
                  transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                  aria-hidden
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icon.svg" alt="" width={56} height={56} className="h-14 w-14" draggable={false} />
                </motion.div>
                <h1 className="font-serif text-[32px] leading-tight tracking-[-0.015em] sm:text-[38px]">
                  {projectName && (mode === "research" || mode === "audit") ? <>{m.label} <span className="italic">{projectName}</span></> : <>What are we digging into<span className="text-accent">?</span></>}
                </h1>
                <AnimatePresence mode="wait">
                  <motion.p key={mode} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }} className="mt-2 max-w-md text-[14px] text-muted">{m.desc}</motion.p>
                </AnimatePresence>
              </div>
              {notConfigured && (
                <div className="mt-5 rounded-xl border border-line bg-panel p-3 text-[13px] text-ink-2">
                  Connect your model first: <Link href="/settings#ai" className="text-accent underline underline-offset-2">Settings → AI</Link>. Any OpenAI-compatible endpoint works (DeepSeek included).
                </div>
              )}
            </motion.div>
          </div>
          {/* Suggestions sit right above the composer, which is pinned to the bottom like a chat app. */}
          <div className="px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1 sm:px-6">
            <div className="mx-auto max-w-[760px]">
              <div className="-mx-1 mb-2.5 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] sm:grid sm:grid-cols-2 sm:overflow-visible">
                {SUGGEST[mode](projectName).map((sug, i) => {
                  const Icon = MODE_SUGGEST_ICON[mode] ?? Sparkles;
                  return (
                    <motion.button
                      key={sug}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * i }}
                      onClick={() => send(sug)}
                      disabled={notConfigured}
                      className="group flex w-[240px] shrink-0 items-start gap-2.5 rounded-xl border border-line bg-panel/60 px-3.5 py-2.5 text-left text-[13px] leading-snug text-ink-2 transition-colors hover:border-line-strong hover:bg-panel hover:text-ink disabled:opacity-50 sm:w-auto"
                    >
                      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint transition-colors group-hover:text-accent" />
                      <span className="line-clamp-2">{sug}</span>
                    </motion.button>
                  );
                })}
              </div>
              {composer(true)}
            </div>
          </div>
        </>
      ) : (
        <>
          <div ref={scroller} className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[760px] space-y-7 px-4 pb-10 pt-4 sm:px-6">
              {messages.map((msg, i) => <Message key={msg.id} msg={msg} streaming={status === "streaming" && i === messages.length - 1} />)}
              {status === "submitted" && (
                <div className="flex items-center gap-3">
                  <DeskAvatar pulse />
                  <span className="shimmer-text text-[13.5px] text-muted">Thinking…</span>
                </div>
              )}
              {error && <div className="rounded-xl border border-line bg-panel p-3 text-[13px] text-neg">{error.message}</div>}
            </div>
          </div>
          <div className="px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1 sm:px-6">
            <div className="mx-auto max-w-[760px]">{composer()}</div>
          </div>
        </>
      )}
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
  claimableSoon: "Claims & dates",
  todayTasks: "Today's tasks",
  portfolio: "Wallets",
  earningsRoi: "Earnings & ROI",
  newsWire: "News wire",
  readingList: "Reading list",
  upcomingMints: "Upcoming mints",
  nftsHeld: "NFTs",
  tokenPrice: "Prices",
  recapCalendar: "Recap & calendar",
  untrackedLeads: "New leads",
  proposeProject: "Proposal",
};

type ToolPart = { type: string; toolCallId: string; state: string; input?: Record<string, unknown>; output?: unknown; errorText?: string; toolName?: string };

function Message({ msg, streaming }: { msg: UIMessage; streaming?: boolean }) {
  const [copied, setCopied] = useState(false);
  if (msg.role === "user") {
    const text = msg.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
    return (
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-[20px] rounded-br-md bg-active px-4 py-2.5 text-[14.5px] leading-relaxed text-ink">{text}</div>
      </motion.div>
    );
  }
  const text = msg.parts.map((p) => (p.type === "text" ? p.text : "")).join("\n\n").trim();
  return (
    <div className="group flex gap-3">
      <DeskAvatar pulse={streaming} />
      <div className="min-w-0 flex-1 space-y-2 pt-0.5">
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
        {!streaming && text && (
          <div className="flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
            <button
              onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[12px] text-muted hover:bg-hover hover:text-ink"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-pos" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
      </div>
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
        <ProjectMark p={{ name: p.name, links: p.links }} size={28} />
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
          <Link href={`/projects/${created ?? exists!.id}`}><Button size="sm">{created ? "Open" : "In farmOS"} <ChevronRight className="h-3.5 w-3.5" /></Button></Link>
        ) : (
          <Button size="sm" variant="primary" onClick={add} disabled={create.isPending}><Plus className="h-3.5 w-3.5" /> Add to farmOS</Button>
        )}
      </div>
    </div>
  );
}
