"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink, KeyRound, Monitor, Moon, RefreshCw, ShieldAlert, Sun, Trash2 } from "lucide-react";
import { signIn } from "next-auth/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { BrandIcon, type BrandId } from "@/components/brand";
import { Marker } from "@/components/panelui/marker";
import { toast } from "@/lib/client/toast";
import { GoogleMark } from "@/app/login/login-form";
import { Page, PageHeader } from "@/components/shell";
import { Checkbox } from "@/components/motion/checkbox";
import { Switch } from "@/components/motion/switch";
import { playUi, setSoundEnabled, useSoundEnabled } from "@/lib/client/sound";
import { Button, Field, Input, Kbd, Pill } from "@/components/ui";
import { cn } from "@/lib/cn";
import { api, keys, useAiConfig, useGoogleStatus, type AiPublic } from "@/lib/client/api";
import { useMounted } from "@/lib/client/use-mounted";
import { Section } from "./section";
import { DataSection, NotifySection } from "./notify-data";

export function SettingsView({ appUrl, allowedEmail }: { appUrl: string; allowedEmail: boolean }) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  return (
    <Page>
      <PageHeader title="Settings" />
      <nav aria-label="Settings sections" className="-mx-1 mb-2 flex gap-1 overflow-x-auto pb-2 text-[12.5px]">
        {[
          ["appearance", "Appearance"],
          ["sound", "Sound"],
          ["ai", "Research desk"],
          ["google", "Google"],
          ["connections", "Connected accounts"],
          ["keys", "API keys"],
          ["notifications", "Notifications"],
          ["keyboard", "Keyboard"],
          ["data", "Data"],
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="shrink-0 rounded-md px-2.5 py-1 text-muted transition-colors hover:bg-hover hover:text-ink">{label}</a>
        ))}
      </nav>
      <Section id="appearance" title="Appearance" desc="Auto follows your system setting.">
        <div className="grid max-w-md grid-cols-3 gap-2">
          {[
            { id: "light", label: "Light", icon: Sun },
            { id: "dark", label: "Dark", icon: Moon },
            { id: "system", label: "Auto", icon: Monitor },
          ].map((o) => (
            <button key={o.id} onClick={() => { setTheme(o.id); playUi("toggle"); }} className={cn("flex flex-col items-center gap-2 rounded-lg border p-3 text-[13px] transition-colors", mounted && theme === o.id ? "border-accent bg-accent-soft text-ink" : "border-line bg-panel text-muted hover:border-line-strong hover:text-ink")}>
              <o.icon className="h-4 w-4" /> {o.label}
            </button>
          ))}
        </div>
      </Section>
      <SoundSection />
      <AiSection />
      <GoogleSection appUrl={appUrl} allowedEmail={allowedEmail} />
      <ConnectionsSection appUrl={appUrl} />
      <ApiKeysSection />
      <NotifySection />
      <Section id="keyboard" title="Keyboard" desc="Work without the mouse.">
        <div className="max-w-md divide-y divide-line rounded-lg border border-line bg-panel text-[13px]">
          {[
            ["Command palette", "⌘K / Ctrl K"],
            ["Search", "/"],
            ["New project", "N"],
            ["Close dialogs", "Esc"],
            ["Editor: heading / list / todo", "# · - · [ ]"],
          ].map(([a, b]) => (
            <div key={a} className="flex items-center justify-between px-3 py-2"><span className="text-ink-2">{a}</span><Kbd>{b}</Kbd></div>
          ))}
        </div>
      </Section>
      <DataSection />
    </Page>
  );
}

function SoundSection() {
  const on = useSoundEnabled();
  return (
    <Section id="sound" title="Sound" desc="Quiet ticks when you complete tasks and a soft chime when the day is clear. Off by default if your system prefers reduced motion.">
      <label className="flex max-w-md items-center justify-between rounded-lg border border-line bg-panel px-3 py-2.5 text-[13.5px]">
        <span className="text-ink-2">UI sounds</span>
        <Switch
          checked={on}
          onCheckedChange={(v) => {
            setSoundEnabled(v);
            if (v) playUi("toggle");
          }}
          ariaLabel="UI sounds"
        />
      </label>
    </Section>
  );
}

function AiSection() {
  const { data } = useAiConfig();
  if (!data) return <Section id="ai" title="Research desk (AI)"><div className="h-40 animate-pulse rounded-lg bg-hover" /></Section>;
  return <AiForm data={data} />;
}

function AiForm({ data }: { data: AiPublic }) {
  const qc = useQueryClient();
  const [baseUrl, setBaseUrl] = useState(data.baseUrl);
  const [model, setModel] = useState(data.model);
  const [tools, setTools] = useState(data.tools);
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    try {
      await api("/api/settings/ai", { method: "PUT", body: { baseUrl, model, tools } });
      qc.invalidateQueries({ queryKey: keys.ai });
      toast.success("AI settings saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const runTest = async () => {
    setTest("Testing…");
    const r = await api<{ ok: boolean; reply?: string; ms?: number; error?: string }>("/api/settings/ai/test", { method: "POST" });
    setTest(r.ok ? `Connected · replied “${r.reply}” in ${r.ms} ms` : `Failed: ${r.error}`);
  };
  return (
    <Section
      id="ai"
      title="Research desk (AI)"
      desc={<>Any OpenAI-compatible endpoint, e.g. DeepSeek <code className="num">https://api.deepseek.com/v1</code> or your own server. The key lives under <a href="#keys" className="underline decoration-faint underline-offset-2 hover:text-ink">API keys</a>.</>}
    >
      <div className="max-w-xl space-y-3">
        <Field label="Base URL"><Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.deepseek.com/v1" className="num" /></Field>
        <Field label="Model"><Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="deepseek-chat" className="num" /></Field>
        <Checkbox
          checked={tools}
          onCheckedChange={setTools}
          label="Enable research tools"
          description="Web fetch, DefiLlama, DexScreener, GeckoTerminal, contract check. Turn off if your model doesn't support tool calls."
         
        />
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button variant="primary" onClick={save} disabled={busy}>Save</Button>
          <Button onClick={runTest} disabled={!data.configured || !data.hasKey}>Test connection</Button>
          <span className="text-[12px] text-faint">Source: {data.source === "settings" ? "saved settings" : data.source === "env" ? "server env" : "not configured"}</span>
        </div>
        {test && <p className={cn("text-[12.5px]", test.startsWith("Failed") ? "text-neg" : "text-muted")}>{test}</p>}
      </div>
    </Section>
  );
}

type KeyItem = { id: string; label: string; ok: boolean; env: string; note: string; mask: string | null };

/** Adapted from ninna-ui's API keys settings block: one table of every secret, masked only. */
function ApiKeysSection() {
  const qc = useQueryClient();
  const ai = useAiConfig();
  const q = useQuery({ queryKey: ["integrations"], queryFn: () => api<{ items: KeyItem[] }>("/api/integrations") });
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  const putKey = async (apiKey: string | null) => {
    setBusy(true);
    try {
      await api("/api/settings/ai", { method: "PUT", body: apiKey === null ? { clearKey: true } : { apiKey } });
      qc.invalidateQueries({ queryKey: keys.ai });
      setVal("");
      setEditing(false);
      toast.success(apiKey === null ? "Saved key removed" : "Key saved (encrypted)");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const d = ai.data;
  const set = (q.data?.items ?? []).filter((i) => i.ok).length;
  const total = (q.data?.items.length ?? 0) + 1;
  return (
    <Section id="keys" title="API keys" desc="Secrets farmOS uses server-side. Values are encrypted or kept in the server environment and only shown masked.">
      <div className="max-w-3xl overflow-hidden rounded-xl border border-line bg-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <div className="text-[14px] font-medium text-ink">Keys</div>
            <div className="text-[12.5px] text-muted">{set + (d?.hasKey ? 1 : 0)} of {total} set</div>
          </div>
          <Button size="sm" variant="primary" onClick={() => setEditing(true)}><KeyRound className="h-3.5 w-3.5" /> {d?.keyFromSettings ? "Replace AI key" : "Add AI key"}</Button>
        </div>
        <div className="flex gap-2.5 border-b border-line bg-accent-soft/40 px-4 py-2.5 text-[12.5px] text-ink-2">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <span><span className="font-medium text-ink">Keep secret keys secure.</span> They never reach the browser; only a masked preview is shown here. Rotate a leaked key at the provider, then replace it.</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-[11.5px] uppercase tracking-[0.08em] text-faint">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Token</th>
                <th className="px-4 py-2 font-medium">Stored in</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              <tr>
                <td className="px-4 py-3 align-top">
                  <div className="font-medium text-ink">AI provider key</div>
                  <div className="text-[12px] text-muted">Research desk, AI review, Feed brief</div>
                </td>
                <td className="px-4 py-3 align-top">
                  {editing ? (
                    <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (val.trim()) putKey(val.trim()); }}>
                      <Input autoFocus type="password" value={val} onChange={(e) => setVal(e.target.value)} placeholder="sk-…" autoComplete="off" className="num h-8 w-52 text-[12.5px]" />
                      <Button size="sm" variant="primary" type="submit" disabled={busy || !val.trim()}>Save</Button>
                      <Button size="sm" variant="ghost" type="button" onClick={() => { setEditing(false); setVal(""); }}>Cancel</Button>
                    </form>
                  ) : d?.keyMask ? <MaskedToken mask={d.keyMask} /> : <span className="text-faint">Not set</span>}
                </td>
                <td className="px-4 py-3 align-top"><EnvTag kind={d?.keyFromSettings ? "saved" : d?.hasKey ? "env" : "none"} /></td>
                <td className="px-4 py-3 text-right align-top">
                  {!editing && (
                    <div className="inline-flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(true)}><RefreshCw className="h-3.5 w-3.5" /> {d?.hasKey ? "Replace" : "Add"}</Button>
                      {d?.keyFromSettings && <Button size="sm" variant="ghost" className="text-neg" onClick={() => { if (confirm("Remove the saved AI key?")) putKey(null); }} disabled={busy}><Trash2 className="h-3.5 w-3.5" /> Revoke</Button>}
                    </div>
                  )}
                </td>
              </tr>
              {(q.data?.items ?? []).map((i) => (
                <tr key={i.id}>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-2 font-medium text-ink">{["opensea", "x", "discord", "github", "telegram", "google"].includes(i.id) && <BrandIcon id={i.id as BrandId} size={16} />}{i.label}</div>
                    <div className="text-[12px] text-muted">{i.note}</div>
                  </td>
                  <td className="px-4 py-3 align-top">{i.ok ? <MaskedToken mask={i.mask ?? "••••••••"} /> : <span className="text-[12px] text-faint"><code className="num">{i.env}</code> missing</span>}</td>
                  <td className="px-4 py-3 align-top"><EnvTag kind={i.ok ? "env" : "none"} /></td>
                  <td className="px-4 py-3 text-right align-top"><a href="https://vercel.com/docs/environment-variables" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-ink">Vercel env <ExternalLink className="h-3 w-3" /></a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Section>
  );
}

function MaskedToken({ mask }: { mask: string }) {
  return <code className="num inline-flex items-center rounded-md bg-hover px-2 py-1 text-[12px] tracking-tight text-ink-2" aria-label="Masked key">{mask}</code>;
}

function EnvTag({ kind }: { kind: "saved" | "env" | "none" }) {
  if (kind === "none") return <Marker tone="gray">Not set</Marker>;
  return kind === "saved" ? <Marker tone="green">Encrypted · settings</Marker> : <Marker tone="blue">Server env</Marker>;
}

function GoogleSection({ appUrl, allowedEmail }: { appUrl: string; allowedEmail: boolean }) {
  const { data } = useGoogleStatus();
  const qc = useQueryClient();
  const origin = typeof window !== "undefined" ? window.location.origin : appUrl;
  return (
    <Section id="google" title="Google" desc="Gmail (read-only) to match project mail, and Calendar to push deadlines and show upcoming events.">
      {!data ? null : !data.configured ? (
        <div className="max-w-xl rounded-lg border border-line bg-panel p-4 text-[13px]">
          <div className="mb-2 flex items-center gap-2 font-medium"><KeyRound className="h-4 w-4 text-muted" /> Not set up yet</div>
          <ol className="list-decimal space-y-1 pl-5 text-ink-2">
            <li>Create an OAuth client (Web) in Google Cloud and enable Gmail API + Google Calendar API.</li>
            <li>Add redirect URI <code className="num break-all rounded bg-hover px-1 text-[12px]">{origin}/api/auth/callback/google</code></li>
            <li>Set <code className="num text-[12px]">GOOGLE_CLIENT_ID</code>, <code className="num text-[12px]">GOOGLE_CLIENT_SECRET</code> (and optionally <code className="num text-[12px]">ALLOWED_EMAIL</code>) in Vercel, then redeploy.</li>
          </ol>
          <p className="mt-2 text-muted">Full steps: <code className="num text-[12px]">SETUP.md</code> in the repo.</p>
        </div>
      ) : data.connected ? (
        <div className="flex max-w-xl flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-panel p-4">
          <div>
            <div className="flex items-center gap-2 text-[14px] font-medium"><Check className="h-4 w-4 text-pos" /> {data.email}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {data.scope?.includes("gmail.readonly") && <Pill tone="green">Gmail read-only</Pill>}
              {data.scope?.includes("calendar") && <Pill tone="blue">Calendar events</Pill>}
              {allowedEmail && <Pill tone="stone">Google login enabled</Pill>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => signIn("google", { redirectTo: "/settings#google" })}>Reconnect</Button>
            <Button size="sm" variant="danger" onClick={async () => { await api("/api/google/disconnect", { method: "POST" }); qc.invalidateQueries({ queryKey: keys.google }); }}>Disconnect</Button>
          </div>
        </div>
      ) : (
        <div className="max-w-xl rounded-lg border border-line bg-panel p-4">
          <p className="mb-3 text-[13px] text-ink-2">Connect the Gmail account you farm with. farmOS asks for Gmail read-only and Calendar events access.</p>
          <Button variant="primary" onClick={() => signIn("google", { redirectTo: "/settings#google" })}><GoogleMark /> Connect Google</Button>
        </div>
      )}
    </Section>
  );
}

type Conn = { id: string; label: string; purpose: string; env: string[]; missing: string[]; configured: boolean; connected: boolean; account: { username: string | null; name: string | null; image: string | null } | null };

function ConnectionsSection({ appUrl }: { appUrl: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["connections"], queryFn: () => api<{ providers: Conn[]; telegramBot: string | null }>("/api/connections") });
  const origin = typeof window !== "undefined" ? window.location.origin : appUrl;
  const refresh = () => qc.invalidateQueries({ queryKey: ["connections"] });
  const disconnect = async (id: string) => {
    try {
      await api(`/api/connections/${id}`, { method: "DELETE" });
      refresh();
      toast.success("Disconnected");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const rows = (q.data?.providers ?? []).filter((p) => p.id !== "google");
  return (
    <Section id="connections" title="Connected accounts" desc="Read-only identities. Tokens are encrypted in your database and never reach the browser.">
      {q.isLoading ? (
        <div className="max-w-xl space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-hover" />)}</div>
      ) : (
        <ul className="max-w-xl divide-y divide-line rounded-lg border border-line bg-panel">
          {rows.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
              <BrandIcon id={p.id as BrandId} size={28} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[13.5px] font-medium text-ink">
                  {p.label}
                  {p.connected ? <Marker tone="green">Connected</Marker> : !p.configured ? <Marker tone="gray">Not set up</Marker> : null}
                </div>
                <div className="truncate text-[12px] text-muted">
                  {p.connected && p.account ? <span className="text-ink-2">{p.account.username ? `@${p.account.username}` : p.account.name}</span> : p.purpose}
                </div>
                {!p.configured && p.missing.length > 0 && (
                  <div className="mt-1 text-[11.5px] text-faint">
                    Set {p.missing.map((m, i) => <span key={m}>{i > 0 && ", "}<code className="num">{m}</code></span>)}
                    {["x", "discord", "github"].includes(p.id) && <> · callback <code className="num break-all">{origin}/api/auth/callback/{p.id}</code></>}
                  </div>
                )}
              </div>
              {p.connected ? (
                <Button size="sm" variant="ghost" onClick={() => disconnect(p.id)}>Disconnect</Button>
              ) : !p.configured ? null : p.id === "telegram" ? (
                <TelegramButton bot={q.data?.telegramBot ?? null} onDone={refresh} />
              ) : p.id === "farcaster" ? (
                <FarcasterLink onDone={refresh} />
              ) : (
                <Button size="sm" onClick={() => signIn(p.id, { redirectTo: "/settings#connections" })}>Connect</Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 max-w-xl text-[12px] text-faint">Setup for each provider is in SETUP.md → Connected accounts. Missing keys only hide the Connect button; nothing else breaks.</p>
    </Section>
  );
}

function FarcasterLink({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open) return <Button size="sm" onClick={() => setOpen(true)}>Link username</Button>;
  return (
    <form
      className="flex w-full items-center gap-2 sm:w-auto"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await api("/api/connections/farcaster", { method: "POST", body: { username: name } });
          onDone();
          toast.success("Farcaster linked");
        } catch (err) {
          toast.error((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="username" className="h-7 w-36 text-[12.5px]" />
      <Button size="sm" variant="primary" type="submit" disabled={busy || !name.trim()}>Link</Button>
    </form>
  );
}

declare global {
  interface Window {
    frioTelegramAuth?: (u: Record<string, unknown>) => void;
  }
}

/** Official Telegram Login Widget, loaded only when the user asks for it. */
function TelegramButton({ bot, onDone }: { bot: string | null; onDone: () => void }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!shown || !host || !bot) return;
    window.frioTelegramAuth = async (u) => {
      try {
        await api("/api/connections/telegram", { method: "POST", body: u });
        onDone();
        toast.success("Telegram connected");
      } catch (e) {
        toast.error((e as Error).message);
      }
    };
    const s = document.createElement("script");
    s.src = "https://telegram.org/js/telegram-widget.js?22";
    s.async = true;
    s.setAttribute("data-telegram-login", bot);
    s.setAttribute("data-size", "medium");
    s.setAttribute("data-radius", "6");
    s.setAttribute("data-request-access", "read");
    s.setAttribute("data-onauth", "frioTelegramAuth(user)");
    host.appendChild(s);
    return () => {
      host.innerHTML = "";
      delete window.frioTelegramAuth;
    };
  }, [shown, host, bot, onDone]);
  if (!bot) return null;
  return shown ? <div ref={setHost} className="min-h-7" /> : <Button size="sm" onClick={() => setShown(true)}>Connect</Button>;
}
