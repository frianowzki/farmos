"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { alertRunsLabel, dailyRunLabel } from "@/lib/dates";
import { Archive, Bell, ChevronRight, Download, FileText, FileUp, RefreshCw, Send, Unlink } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { BrandIcon } from "@/components/brand";
import { Switch } from "@/components/motion/switch";
import { Button, Dialog, Pill } from "@/components/ui";
import { api } from "@/lib/client/api";
import { toast } from "@/lib/client/toast";
import { Section } from "./section";

type Notify = {
  linked: boolean; chatName: string | null; enabled: boolean; mints: boolean; deadlines: boolean; tasks: boolean; streaks: boolean; claims: boolean; prices: boolean;
  lastSentAt: string | null; lastResult: string | null; configured: boolean; botUsername: string | null; waiting?: boolean;
};

const ALERTS: { id: keyof Notify; label: string; hint: string }[] = [
  { id: "claims", label: "Claim alerts", hint: "A watched claim page goes live or a wallet becomes eligible" },
];

const TOGGLES: { id: keyof Notify; label: string; hint: string }[] = [
  { id: "mints", label: "Mint countdowns", hint: "Watched mints starting within 24h" },
  { id: "deadlines", label: "Campaign deadlines", hint: "Deadlines, snapshots, TGE and claim windows in the next 3 days" },
  { id: "tasks", label: "Today's tasks", hint: "Open tasks due today (turn single tasks off with the bell on Daily tasks)" },
  { id: "streaks", label: "Streaks at risk", hint: "Due today with a streak of 2 or more" },
];

export function NotifySection() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["notify"], queryFn: () => api<Notify>("/api/notify") });
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const set = (n: Notify) => qc.setQueryData(["notify"], n);

  const patch = async (p: Record<string, unknown>) => { set(await api<Notify>("/api/notify", { method: "PATCH", body: p })); };
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (!data) return <Section id="notifications" title="Notifications"><div className="h-32 animate-pulse rounded-lg bg-hover" /></Section>;

  return (
    <Section id="notifications" title="Notifications" desc={<>Daily Telegram digest at {dailyRunLabel()} via {data.botUsername ? <span className="num">@{data.botUsername}</span> : "your bot"}. Read-only: the bot only sends you messages.</>}>
      {!data.configured ? (
        <div className="max-w-xl rounded-lg border border-dashed border-line px-4 py-4 text-[13px] text-muted">Set <span className="num">TELEGRAM_BOT_TOKEN</span> on Vercel to enable notifications.</div>
      ) : (
        <div className="max-w-xl space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-panel px-3 py-3">
            <div className="flex items-center gap-3">
              <BrandIcon id="telegram" size={22} />
              <div>
                <div className="text-[13.5px] font-medium">{data.linked ? `Linked to ${data.chatName ?? "your chat"}` : "No chat linked"}</div>
                <div className="text-[12px] text-muted">
                  {data.lastSentAt ? `Last sent ${new Date(data.lastSentAt).toLocaleString()}` : "Nothing sent yet"}
                  {data.lastResult && data.lastResult !== "ok" && <span className="text-neg"> · {data.lastResult}</span>}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.linked ? (
                <>
                  <Button size="sm" disabled={busy !== null} onClick={() => run("test", async () => { await api("/api/notify/test", { method: "POST" }); toast.success("Test digest sent"); qc.invalidateQueries({ queryKey: ["notify"] }); })}>
                    <Send className="h-3.5 w-3.5" /> {busy === "test" ? "Sending…" : "Send test"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => run("unlink", async () => { await patch({ unlink: true }); })}><Unlink className="h-3.5 w-3.5" /> Unlink</Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="primary" disabled={busy !== null} onClick={() => run("link", async () => {
                    const r = await api<{ url: string | null }>("/api/notify/link", { method: "POST", body: {} });
                    setLink(r.url);
                    if (r.url) window.open(r.url, "_blank", "noopener");
                  })}>
                    <Bell className="h-3.5 w-3.5" /> Link Telegram
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy !== null} title="Use the account from Connected accounts" onClick={() => run("connected", async () => { set(await api<Notify>("/api/notify/link", { method: "POST", body: { mode: "connected" } })); toast.success("Linked"); })}>
                    Use connected account
                  </Button>
                </>
              )}
            </div>
          </div>

          {link && !data.linked && (
            <div className="rounded-lg border border-line bg-panel px-3 py-3 text-[13px]">
              <p className="text-ink-2">Press <b>Start</b> in Telegram, then come back and confirm. The link works once and expires in 30 minutes.</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <a href={link} target="_blank" rel="noreferrer" className="num truncate text-[12px] text-accent underline-offset-2 hover:underline">{link.replace(/start=.*/, "start=…")}</a>
                <Button size="sm" disabled={busy !== null} onClick={() => run("verify", async () => {
                  const r = await api<Notify>("/api/notify/link", { method: "PUT" });
                  if (r.waiting) toast.error("Not seen yet. Press Start in Telegram, then try again.");
                  else { set(r); setLink(null); toast.success("Telegram linked"); }
                })}>
                  <RefreshCw className="h-3.5 w-3.5" /> {busy === "verify" ? "Checking…" : "I pressed Start"}
                </Button>
              </div>
            </div>
          )}

          <div className="divide-y divide-line rounded-lg border border-line bg-panel text-[13.5px]">
            <label className="flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="font-medium">Daily digest</span>
              <Switch checked={data.enabled} onCheckedChange={(v) => patch({ enabled: v })} ariaLabel="Daily digest" />
            </label>
            {TOGGLES.map((t) => (
              <label key={t.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <span>
                  <span className="text-ink-2">{t.label}</span>
                  <span className="block text-[12px] text-muted">{t.hint}</span>
                </span>
                <Switch checked={Boolean(data[t.id])} disabled={!data.enabled} onCheckedChange={(v) => patch({ [t.id]: v })} ariaLabel={t.label} />
              </label>
            ))}
          </div>
          <div className="mt-3 divide-y divide-line rounded-lg border border-line bg-panel text-[13.5px]">
            <div className="px-3 py-2.5 font-medium">Instant alerts <span className="font-normal text-muted">· checked at {alertRunsLabel()}</span></div>
            {ALERTS.map((t) => (
              <label key={t.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <span>
                  <span className="text-ink-2">{t.label}</span>
                  <span className="block text-[12px] text-muted">{t.hint}</span>
                </span>
                <Switch checked={data[t.id] !== false} onCheckedChange={(v) => patch({ [t.id]: v })} ariaLabel={t.label} />
              </label>
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}

const CSV_TABLES = ["projects", "positions", "earnings", "costs", "tasks", "completions", "diary", "wallets", "mints", "feed", "attachments", "threads"] as const;

type Backups = { configured: boolean; keep: number; backups: { pathname: string; size: number; uploadedAt: string }[] };
type DryRun = { dryRun: true; exportedAt: string | null; counts: Record<string, number> };

export function DataSection() {
  const qc = useQueryClient();
  const { data: bk } = useQuery({ queryKey: ["backups"], queryFn: () => api<Backups>("/api/backups") });
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ text: string; name: string; dry: DryRun } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const pick = async (f: File) => {
    const text = await f.text();
    const res = await fetch("/api/import", { method: "POST", body: text });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(j.error ?? "Invalid backup");
    setPending({ text, name: f.name, dry: j as DryRun });
  };

  const restore = async () => {
    if (!pending) return;
    setBusy("restore");
    const res = await fetch("/api/import?confirm=1", { method: "POST", body: pending.text });
    const j = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return toast.error(j.error ?? "Restore failed");
    setPending(null);
    toast.success("Backup restored");
    qc.invalidateQueries();
  };

  return (
    <Section id="data" title="Data" desc="Everything lives in your Neon Postgres database.">
      <div className="max-w-xl divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
        <div className="p-3.5">
          <DataLabel title="Export" hint="Never includes OAuth tokens or API keys" />
          <div className="grid grid-cols-3 gap-2">
            <DataLink href="/api/export" icon={<Download className="h-3.5 w-3.5" />} label="Backup" sub="JSON" />
            <DataLink href="/api/reports?format=csv" icon={<Download className="h-3.5 w-3.5" />} label="Report" sub="CSV" />
            <DataLink href="/report" icon={<FileText className="h-3.5 w-3.5" />} label="Report" sub="Print" />
          </div>
          <details className="group mt-2.5">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-[12px] text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
              <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" /> Single tables (CSV)
            </summary>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CSV_TABLES.map((t) => (
                <a key={t} href={`/api/export?format=csv&table=${t}`} className="rounded-md border border-line px-2 py-1 text-[12px] text-ink-2 transition-colors hover:bg-hover hover:text-ink">{t}</a>
              ))}
            </div>
          </details>
        </div>

        <div className="flex items-center justify-between gap-3 p-3.5">
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-ink">Restore</div>
            <div className="text-[12px] text-muted">Replaces current data. A safety snapshot is saved first.</div>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ""; }} />
          <Button size="sm" className="shrink-0" onClick={() => fileRef.current?.click()}><FileUp className="h-3.5 w-3.5" /> Import</Button>
        </div>

        <div className="p-3.5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-ink">Daily snapshots</div>
              {bk?.configured && <div className="text-[12px] text-muted">Every day at {dailyRunLabel()} · newest {bk.keep} kept</div>}
            </div>
            {bk?.configured && (
              <Button size="sm" variant="ghost" className="shrink-0" disabled={busy !== null} onClick={async () => {
                setBusy("snap");
                try { await api("/api/backups", { method: "POST" }); toast.success("Snapshot saved"); qc.invalidateQueries({ queryKey: ["backups"] }); } catch (e) { toast.error((e as Error).message); }
                setBusy(null);
              }}>
                <Archive className="h-3.5 w-3.5" /> {busy === "snap" ? "Saving…" : "Snapshot"}
              </Button>
            )}
          </div>
          {!bk ? (
            <div className="h-12 animate-pulse rounded-lg bg-hover" />
          ) : !bk.configured ? (
            <div className="text-[12.5px] text-muted">Blob storage is not set up.</div>
          ) : bk.backups.length === 0 ? (
            <div className="text-[12.5px] text-muted">No snapshots yet.</div>
          ) : (
            <div className="no-scrollbar max-h-[180px] divide-y divide-line overflow-y-auto rounded-lg border border-line">
              {bk.backups.map((b) => (
                <a key={b.pathname} href={`/api/backups?download=${encodeURIComponent(b.pathname)}`} className="flex items-center justify-between gap-3 px-3 py-2 text-[12.5px] transition-colors hover:bg-hover">
                  <span className="num min-w-0 truncate text-ink-2">{snapName(b.pathname)}</span>
                  <span className="flex shrink-0 items-center gap-2.5 text-faint">
                    <span className="num text-[11.5px]">{(b.size / 1024).toFixed(1)} KB</span>
                    <Download className="h-3.5 w-3.5" aria-label="Download" />
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={pending !== null} onClose={() => setPending(null)} title="Restore this backup?">
        {pending && (
          <div className="space-y-3 text-[13.5px]">
            <p className="text-ink-2"><span className="num">{pending.name}</span>{pending.dry.exportedAt && <> · exported {new Date(pending.dry.exportedAt).toLocaleString()}</>}</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(pending.dry.counts).filter(([, n]) => n > 0).map(([k, n]) => <Pill key={k}>{k} {n}</Pill>)}
            </div>
            <p className="text-neg">All current projects, tasks, diary, wallets and positions will be replaced. Your AI key and Telegram link stay.</p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
              <Button variant="primary" disabled={busy !== null} onClick={restore}>{busy === "restore" ? "Restoring…" : "Replace and restore"}</Button>
            </div>
          </div>
        )}
      </Dialog>
    </Section>
  );
}

function DataLabel({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-2.5 flex items-baseline justify-between gap-3">
      <span className="text-[13px] font-medium text-ink">{title}</span>
      {hint && <span className="truncate text-[11.5px] text-faint">{hint}</span>}
    </div>
  );
}

function DataLink({ href, icon, label, sub }: { href: string; icon: ReactNode; label: string; sub: string }) {
  return (
    <a href={href} className="flex min-w-0 flex-col items-start gap-1 rounded-lg border border-line px-2.5 py-2 transition-colors hover:border-line-strong hover:bg-hover">
      <span className="text-muted">{icon}</span>
      <span className="w-full truncate text-[12.5px] font-medium text-ink">{label}</span>
      <span className="font-label text-[10.5px] uppercase tracking-[0.1em] text-faint">{sub}</span>
    </a>
  );
}

/** "backups/2026-11-10T00-00-03Z.json" → "Nov 10, 2026 · 07:00" style label; falls back to the file name. */
function snapName(path: string) {
  const name = path.replace(/^backups\//, "");
  const m = name.match(/(\d{4}-\d{2}-\d{2})(?:[T_ ](\d{2})[-:](\d{2}))?/);
  if (!m) return name;
  const d = new Date(m[2] ? `${m[1]}T${m[2]}:${m[3]}:00Z` : `${m[1]}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return name;
  return d.toLocaleString([], { month: "short", day: "numeric", year: "numeric", ...(m[2] ? { hour: "numeric", minute: "2-digit" } : {}) });
}
