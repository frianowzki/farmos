"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, ExternalLink, KeyRound, Monitor, Moon, RefreshCw, ShieldAlert, Sun, Trash2 } from "lucide-react";
import { signIn } from "next-auth/react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { dailyRunLabel } from "@/lib/dates";
import { BrandIcon, type BrandId } from "@/components/brand";
import { Marker } from "@/components/panelui/marker";
import { toast } from "@/lib/client/toast";
import { GoogleMark } from "@/app/login/login-form";
import { Page, PageHeader } from "@/components/shell";
import { Checkbox } from "@/components/motion/checkbox";
import { Switch } from "@/components/motion/switch";
import { playUi, setSoundEnabled, useSoundEnabled } from "@/lib/client/sound";
import { Button, Field, Input, Kbd, NativeSelect } from "@/components/ui";
import { cn } from "@/lib/cn";
import { api, keys, useAiConfig, useGoogleStatus, useProfile, type AiPublic, type ProfileInfo } from "@/lib/client/api";
import { useMounted } from "@/lib/client/use-mounted";
import { Section } from "./section";
import { DataSection, NotifySection } from "./notify-data";
import { AccentPicker } from "@/components/accent-picker";

export function SettingsView({ appUrl, allowedEmail }: { appUrl: string; allowedEmail: boolean }) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const profile = useProfile();
  const isDefault = profile.data ? profile.data.id === "default" : true;
  return (
    <Page>
      <PageHeader title="Settings" />
      <nav aria-label="Settings sections" className="-mx-1 mb-2 flex gap-1 overflow-x-auto pb-2 text-[12.5px]">
        {[
          ["profile", "Profile"],
          ["appearance", "Appearance"],
          ["sound", "Sound"],
          ["ai", "Research desk"],
          ...(isDefault ? [["google", "Google"]] : []),
          ["connections", "Connected accounts"],
          ["keys", "API keys"],
          ["notifications", "Notifications"],
          ["keyboard", "Keyboard"],
          ["data", "Data"],
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="shrink-0 rounded-md px-2.5 py-1 text-muted transition-colors hover:bg-hover hover:text-ink">{label}</a>
        ))}
      </nav>
      {profile.data ? <ProfileForm key={`${profile.data.name}|${profile.data.tz}|${profile.data.fiat}`} data={profile.data} /> : <Section id="profile" title="Profile"><div className="h-16 animate-pulse rounded-lg bg-hover" /></Section>}
      <Section id="appearance" title="Appearance" desc="Auto follows your system setting. Accent is saved on this device for this profile.">
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
        <div className="mt-4 mb-2 text-[12px] font-medium text-muted">Accent</div>
        <AccentPicker />
      </Section>
      <SoundSection />
      <AiSection />
      {isDefault && <GoogleSection appUrl={appUrl} allowedEmail={allowedEmail} />}
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

function ProfileForm({ data }: { data: ProfileInfo }) {
  const qc = useQueryClient();
  const [name, setName] = useState(data.name);
  const [tz, setTz] = useState(data.tz);
  const [fiat, setFiat] = useState<string>(data.fiat ?? "usd");
  const [busy, setBusy] = useState(false);
  const zones = useMemo(() => {
    const all = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
    return all.includes(data.tz) ? all : [data.tz, ...all];
  }, [data.tz]);
  const dirty = name.trim() !== data.name || tz !== data.tz || fiat !== data.fiat;
  const save = async () => {
    if (!dirty || !name.trim()) return;
    setBusy(true);
    try {
      await api("/api/profile", { method: "PUT", body: { name, tz, fiat } });
      if (tz !== data.tz) {
        // "Today", streaks and the clock are computed client-side from the zone cookie: reload once.
        sessionStorage.setItem("frio_tz_reload", tz);
        window.location.reload();
        return;
      }
      qc.invalidateQueries({ queryKey: keys.profile });
      toast.success("Profile saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section id="profile" title="Profile" desc="Your name in greetings and your time zone for the clock, “today”, streaks, recaps and the daily digest. Each profile has its own data.">
      <div className="grid max-w-md gap-3">
        <Field label="Display name"><Input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} /></Field>
        <Field label="Time zone" hint={`Daily digest and backup run at ${dailyRunLabel(tz)}.`}>
          <select value={tz} onChange={(e) => setTz(e.target.value)} className="num h-9 w-full rounded-md border border-line bg-panel px-2 text-[13.5px] text-ink focus:border-line-strong focus:outline-none focus:ring-2 focus:ring-[var(--ring)] sm:h-8">
            {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
          </select>
        </Field>
        <Field label="Default currency" hint="The Convert card and earnings show this currency first.">
          <NativeSelect value={fiat} onChange={setFiat} options={[{ id: "usd", label: "USD" }, { id: "usdt", label: "USDT" }, { id: "idr", label: "IDR · Rupiah" }, { id: "php", label: "PHP · Peso" }]} />
        </Field>
        <div><Button variant="primary" onClick={save} disabled={busy || !name.trim() || !dirty}>Save</Button></div>
      </div>
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
  const [open, setOpen] = useState(false);
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
        <div className={cn("flex flex-wrap items-center justify-between gap-3 px-4 py-3", open && "border-b border-line")}>
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="api-keys-body" className="-m-1 flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 text-left hover:bg-hover/60">
            <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-90")} />
            <div>
              <div className="text-[14px] font-medium text-ink">Keys</div>
              <div className="text-[12.5px] text-muted">{set + (d?.hasKey ? 1 : 0)} of {total} set · {open ? "Hide" : "Show"}</div>
            </div>
          </button>
          <Button size="sm" variant="primary" onClick={() => { setOpen(true); setEditing(true); }}><KeyRound className="h-3.5 w-3.5" /> {d?.keyFromSettings ? "Replace AI key" : "Add AI key"}</Button>
        </div>
        {open && (
        <div id="api-keys-body">
        <div className="flex gap-2.5 border-b border-line bg-accent-soft/40 px-4 py-2.5 text-[12.5px] text-ink-2">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <span><span className="font-medium text-ink">Keep secret keys secure.</span> They never reach the browser; only a masked preview is shown here. Rotate a leaked key at the provider, then replace it.</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-[11.5px] uppercase tracking-[0.08em] text-faint">
                <th className="w-[40%] px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Token</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Stored in</th>
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
        )}
      </div>
    </Section>
  );
}

function MaskedToken({ mask }: { mask: string }) {
  return <code className="num inline-flex items-center rounded-md bg-hover px-2 py-1 text-[12px] tracking-tight text-ink-2" aria-label="Masked key">{mask}</code>;
}

function EnvTag({ kind }: { kind: "saved" | "env" | "none" }) {
  return <span className="whitespace-nowrap">{envTag(kind)}</span>;
}

function envTag(kind: "saved" | "env" | "none") {
  if (kind === "none") return <Marker tone="gray">Not set</Marker>;
  return kind === "saved" ? <Marker tone="green">Encrypted</Marker> : <Marker tone="blue">Server env</Marker>;
}

function GoogleSection({ appUrl }: { appUrl: string; allowedEmail?: boolean }) {
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
            <div className="flex min-w-0 items-center gap-2.5 text-[14px] font-medium">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brands/gmail.webp" alt="Gmail" width={20} height={20} className="h-5 w-5 shrink-0 object-contain" />
              <span className="truncate">{data.email}</span>
              <Check className="h-4 w-4 shrink-0 text-pos" />
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
  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: ["connections"] }), [qc]);
  // Result of an OAuth link / Telegram redirect: show it here instead of bouncing to /login.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const err = sp.get("connect_error");
    const ok = sp.get("connected");
    if (!err && !ok) return;
    const msg: Record<string, string> = {
      AccessDenied: "Access was denied. Approve the request on the provider's page and try again.",
      Configuration: "The provider rejected the callback. Check its redirect URL and keys (SETUP.md).",
      OAuthAccountNotLinked: "That account is already linked elsewhere.",
      telegram_signature: "Telegram's signature check failed. Try again.",
      telegram_not_configured: "Telegram isn't set up on the server.",
    };
    if (err) toast.error(msg[err] ?? "Couldn't connect that account. Try again.");
    if (ok) toast.success(`${ok[0].toUpperCase()}${ok.slice(1)} connected`);
    window.history.replaceState(null, "", "/settings#connections");
  }, []);
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


/**
 * Telegram linking. Primary: a one-time deep link to the bot (tap Start in Telegram, the server
 * reads the /start message), so there's no popup or phone-number step at all. Fallback: the
 * official Login Widget in redirect mode (data-auth-url), which doesn't depend on popup postMessage.
 */
function TelegramButton({ bot, onDone }: { bot: string | null; onDone: () => void }) {
  const [link, setLink] = useState<{ url: string; token: string; expiresAt: number } | null>(null);
  const [widget, setWidget] = useState(false);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!link) return;
    let stop = false;
    const tick = async () => {
      if (stop) return;
      if (Date.now() > link.expiresAt) { setLink(null); toast.error("Telegram link expired. Try again."); return; }
      try {
        const r = await api<{ status: string; username?: string | null; error?: string }>(`/api/connections/telegram/link?token=${link.token}`);
        if (r.status === "linked") { setLink(null); onDone(); toast.success(r.username ? `Telegram @${r.username} connected` : "Telegram connected"); return; }
        if (r.status === "error") { setLink(null); toast.error(r.error ?? "Telegram link failed"); return; }
      } catch {}
      if (!stop) setTimeout(tick, 2500);
    };
    const t = setTimeout(tick, 2500);
    return () => { stop = true; clearTimeout(t); };
  }, [link, onDone]);
  useEffect(() => {
    if (!widget || !host || !bot) return;
    const s = document.createElement("script");
    s.src = "https://telegram.org/js/telegram-widget.js?22";
    s.async = true;
    s.setAttribute("data-telegram-login", bot);
    s.setAttribute("data-size", "medium");
    s.setAttribute("data-radius", "6");
    s.setAttribute("data-request-access", "write");
    s.setAttribute("data-auth-url", `${window.location.origin}/api/connections/telegram/callback`);
    host.appendChild(s);
    return () => { host.innerHTML = ""; };
  }, [widget, host, bot]);
  if (!bot) return null;
  const start = async () => {
    // Open the tab synchronously (popup blockers), then point it at the deep link.
    const w = window.open("about:blank", "_blank");
    try {
      const r = await api<{ url: string; token: string; expiresAt: number }>("/api/connections/telegram/link", { method: "POST" });
      setLink(r);
      if (w) w.location.href = r.url;
      else window.location.href = r.url;
    } catch (e) {
      w?.close();
      toast.error((e as Error).message);
    }
  };
  if (widget) return <div className="flex flex-col items-end gap-1"><div ref={setHost} className="min-h-7" /><button type="button" onClick={() => setWidget(false)} className="text-[11.5px] text-faint hover:text-ink">Back</button></div>;
  if (link) {
    return (
      <div className="flex flex-col items-end gap-1 text-right">
        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-2"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" /> Tap <b>Start</b> in Telegram…</span>
        <span className="flex gap-2 text-[11.5px]">
          <a href={link.url} target="_blank" rel="noreferrer" className="text-muted underline underline-offset-2 hover:text-ink">Open again</a>
          <button type="button" onClick={() => setLink(null)} className="text-faint hover:text-ink">Cancel</button>
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" onClick={start}>Connect</Button>
      <button type="button" onClick={() => setWidget(true)} className="text-[11.5px] text-faint hover:text-ink">or use Telegram Login</button>
    </div>
  );
}
