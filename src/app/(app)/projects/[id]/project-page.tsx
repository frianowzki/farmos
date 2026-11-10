"use client";
import { ProjectMark } from "@/components/project-mark";
import { useQueryClient } from "@tanstack/react-query";
import { AtSign, BadgeCheck, Banknote, CalendarDays, CalendarPlus, CalendarRange, ChevronRight, CircleDot, Coins, Flag, Gauge, Layers, Link2, Mail, MoreHorizontal, Palette, Pin, PinOff, Plus, RefreshCw, ScanSearch, ShieldAlert, Sparkles, Star, Tag, Telescope, Trash2, Wallet as WalletIcon, Waypoints, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "@/lib/client/toast";
import { Editor } from "@/components/editor";
import { MailList } from "@/components/mail";
import { Page } from "@/components/shell";
import { ChainLabel, ChainLogo } from "@/components/chain-logo";
import { TimePicker } from "@/components/time-picker";
import { LinkIcon } from "@/components/icons/brand-glyphs";
import { AddTask, TaskRow, useTaskModel } from "@/components/tasks";
import { Button, DateField, Dialog, Empty, InlineText, Pill, Popover, SelectPill, Skeleton, TagInput } from "@/components/ui";
import { DeleteProjectDialog } from "@/components/delete-project";
import { ColorSelector, ColorSelectorItem, ColorSelectorList } from "@/components/motion/color-selector";
import { WheelPicker } from "@/components/motion/wheel-picker";
import { Attachments } from "@/components/panelui/attachment";
import { AirdropCheckerPanel } from "@/components/airdrop-checker";
import { ProjectEarnings } from "@/components/earnings";
import { ProjectCosts } from "@/components/costs";
import { claimBadge } from "@/lib/claim";
import { AiReviewPanel } from "@/components/ai-review";
import type { AiReview } from "@/db/schema";
import { Questionnaire } from "@/components/panelui/questionnaire";
import { Rating } from "@/components/panelui/rating";
import { AUDIT, auditScore, scoreToRating } from "@/lib/audit";
import { addDays, clockInZone } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { CHAIN_SUGGESTIONS, KEY_DATES, LINK_FIELDS } from "@/lib/constants";
import { today as todayFn } from "@/lib/dates";
import { pct, relDay, relWhen, shortAddr, tone, usd } from "@/lib/format";
import { api, keys, useGoogleStatus, useProject, useUpdateProject, useWallets, type Position, type Project } from "@/lib/client/api";
import { CATEGORY_OPTS, ELIGIBILITY_OPTS, PRIORITY_OPTS, RISK_OPTS, STATUS_OPTS, TIER_OPTS } from "@/lib/options";
import { positionPnl, projectPnl } from "@/lib/pnl";

const TABS = [
  { id: "notes", label: "Notes" },
  { id: "positions", label: "Positions & PnL" },
  { id: "tasks", label: "Tasks" },
  { id: "diary", label: "Diary" },
  { id: "mail", label: "Mail" },
  { id: "files", label: "Files" },
  { id: "earnings", label: "Earnings" },
  { id: "costs", label: "Gas & capital" },
  { id: "claim", label: "Claim" },
];

export function ProjectPage({ id }: { id: string }) {
  const { data, isLoading, error } = useProject(id);
  const update = useUpdateProject();
  const qc = useQueryClient();
  const [tab, setTab] = useState("notes");
  const today = todayFn();
  if (isLoading) return <Page><Skeleton className="mb-4 h-10 w-1/2" /><Skeleton className="h-64" /></Page>;
  if (error || !data) return <Page><Empty title="Project not found" body="It may have been deleted." action={<Link href="/projects"><Button>Back to projects</Button></Link>} /></Page>;
  const p = data.project;
  const set = (patch: Partial<Project>) => update.mutate({ id, patch });
  const money = projectPnl(p, data.positions);
  const cat = CATEGORY_OPTS.find((c) => c.id === p.category);

  return (
    <Page>
      <div className="mb-5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1 text-[13px] text-muted">
          <Link href="/projects" className="rounded px-1 hover:bg-hover hover:text-ink">Projects</Link>
          <ChevronRight className="h-3.5 w-3.5 text-faint" />
          <Link href={`/projects?cat=${p.category}`} className="rounded px-1 hover:bg-hover hover:text-ink">{cat?.label}</Link>
          <ChevronRight className="h-3.5 w-3.5 text-faint" />
          <span className="truncate text-ink-2">{p.name}</span>
        </div>
        <ProjectActions p={p} />
      </div>

      <div className="mb-1 flex items-start gap-3">
        <ProjectMark p={p} size={44} className="mt-1 rounded-[10px]" />
        <div className="min-w-0 flex-1">
          <TitleInput value={p.name} onSave={(name) => name.trim() && set({ name: name.trim() })} />
          <div className="group/sum mt-0.5 flex items-center gap-2">
            <input
              key={p.summary ?? ""}
              defaultValue={p.summary ?? ""}
              onBlur={(e) => e.target.value !== (p.summary ?? "") && set({ summary: e.target.value || null })}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              placeholder="Add a one-line summary"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-ink-2 outline-none placeholder:text-faint"
            />
            {(p.links?.x || p.links?.site) && <BioButton p={p} set={set} />}
          </div>
        </div>
      </div>

      <ClaimLine p={p} today={today} onOpen={() => setTab("claim")} />
      <Properties p={p} set={set} today={today} />
      <MoneyStrip p={p} money={money} set={set} />

      <div className="mb-4 mt-8 flex gap-5 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn("-mb-px whitespace-nowrap border-b-2 pb-2 text-[13.5px] transition-colors", tab === t.id ? "border-ink font-medium text-ink" : "border-transparent text-muted hover:text-ink")}>
            {t.label}
            {t.id === "positions" && data.positions.length > 0 && <span className="num ml-1.5 text-[11.5px] text-faint">{data.positions.length}</span>}
            {t.id === "diary" && data.diary.length > 0 && <span className="num ml-1.5 text-[11.5px] text-faint">{data.diary.length}</span>}
            {t.id === "files" && data.attachments.length > 0 && <span className="num ml-1.5 text-[11.5px] text-faint">{data.attachments.length}</span>}
            {t.id === "tasks" && data.tasks.length > 0 && <span className="num ml-1.5 text-[11.5px] text-faint">{data.tasks.length}</span>}
          </button>
        ))}
      </div>

      {tab === "notes" && <Editor value={p.notes} onSave={(html) => update.mutateAsync({ id, patch: { notes: html } }).then(() => undefined)} />}
      {tab === "positions" && <Positions projectId={id} positions={data.positions} />}
      {tab === "tasks" && <ProjectTasks projectId={id} />}
      {tab === "diary" && <ProjectDiary projectId={id} entries={data.diary} />}
      {tab === "mail" && <MailList projectId={id} />}
      {tab === "earnings" && <ProjectEarnings projectId={id} />}
      {tab === "costs" && <ProjectCosts projectId={id} />}
      {tab === "claim" && <AirdropCheckerPanel projectId={id} checker={p.checker ?? null} wallets={p.wallets} />}
      {tab === "files" && (
        <Attachments
          items={data.attachments}
          target={{ projectId: id }}
          onChange={() => qc.invalidateQueries({ queryKey: keys.project(id) })}
          onRemove={async (aid) => {
            await api(`/api/attachments/${aid}`, { method: "DELETE" });
            qc.invalidateQueries({ queryKey: keys.project(id) });
          }}
        />
      )}
    </Page>
  );
}

function ClaimLine({ p, today, onOpen }: { p: Project; today: string; onOpen: () => void }) {
  const b = claimBadge(p, today);
  if (!b) return null;
  const at = p.checker?.lastRun?.at;
  return (
    <button type="button" onClick={onOpen} className="mt-3 inline-flex items-center gap-2 rounded-md px-1 py-0.5 text-[12px] text-faint hover:bg-hover">
      <Pill tone={b.tone} dot>{b.label}</Pill>
      {at && <span>checked {new Date(at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>}
    </button>
  );
}

/** Pull the project's X bio (or website description) into the summary. Asks before replacing a written one. */
function BioButton({ p, set }: { p: Project; set: (patch: Partial<Project>) => void }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const b = await api<{ bio: string; source: string }>(`/api/projects/${p.id}/bio`);
      if (b.bio === p.summary) return toast.success("Summary already matches the bio");
      if (p.summary?.trim() && !confirm(`Replace your summary with this?\n\n${b.bio}`)) return;
      set({ summary: b.bio });
      toast.success(b.source === "website" ? "Filled from the website" : "Filled from X bio");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      title={p.links?.x ? "Fetch from X bio" : "Fetch from website"}
      className={cn("inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[12px] text-muted hover:bg-hover hover:text-ink disabled:opacity-60", p.summary?.trim() && "sm:opacity-0 sm:group-hover/sum:opacity-100 sm:focus-visible:opacity-100")}
    >
      {p.links?.x ? <LinkIcon field="x" /> : <RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} />}
      <span className="max-sm:hidden">{busy ? "Fetching…" : p.links?.x ? "Fetch from X bio" : "Fetch from site"}</span>
    </button>
  );
}

function TitleInput({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  return (
    <input
      key={value}
      defaultValue={value}
      onBlur={(e) => e.target.value !== value && onSave(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      aria-label="Project name"
      className="w-full bg-transparent font-serif text-[32px] leading-[1.15] tracking-[-0.015em] text-ink outline-none sm:text-[38px]"
    />
  );
}

function ProjectActions({ p }: { p: Project }) {
  const router = useRouter();
  const qc = useQueryClient();
  const update = useUpdateProject();
  const g = useGoogleStatus();
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [del, setDel] = useState(false);
  const [btn, setBtn] = useState<HTMLButtonElement | null>(null);
  const sync = async () => {
    setSyncing(true);
    try {
      const r = await api<{ synced: number; removed: number }>("/api/google/calendar/sync", { method: "POST", body: { projectId: p.id } });
      toast.success(r.synced ? `Synced ${r.synced} date${r.synced > 1 ? "s" : ""} to Google Calendar` : "No dates to sync. Add a deadline or key date first.");
      qc.invalidateQueries({ queryKey: keys.project(p.id) });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSyncing(false);
    }
  };
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Link href={`/assistant?project=${p.id}&mode=research`} className="hidden sm:block"><Button size="sm" variant="ghost"><Telescope className="h-3.5 w-3.5" /> Research</Button></Link>
      <Link href={`/assistant?project=${p.id}&mode=audit`} className="hidden sm:block"><Button size="sm" variant="ghost"><ScanSearch className="h-3.5 w-3.5" /> Audit</Button></Link>
      <Button size="icon" variant="ghost" onClick={() => update.mutate({ id: p.id, patch: { pinned: !p.pinned } })} title={p.pinned ? "Unpin" : "Pin to sidebar"} aria-label="Pin">
        {p.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
      </Button>
      <Button ref={setBtn} size="icon" variant="ghost" onClick={() => setOpen((o) => !o)} aria-label="More"><MoreHorizontal className="h-4 w-4" /></Button>
      <Popover anchor={btn} open={open} onClose={() => setOpen(false)} align="end" width={240}>
        <MenuItem icon={<Telescope className="h-4 w-4" />} onClick={() => router.push(`/assistant?project=${p.id}&mode=research`)}>Deep research</MenuItem>
        <MenuItem icon={<ScanSearch className="h-4 w-4" />} onClick={() => router.push(`/assistant?project=${p.id}&mode=audit`)}>Audit this project</MenuItem>
        <MenuItem icon={<CalendarPlus className="h-4 w-4" />} disabled={!g.data?.connected || syncing} onClick={() => { setOpen(false); sync(); }}>
          {g.data?.connected ? (syncing ? "Syncing…" : "Sync dates to Google Calendar") : "Calendar sync (connect Google)"}
        </MenuItem>
        <div className="my-1 h-px bg-line" />
        <MenuItem
          icon={<Trash2 className="h-4 w-4" />}
          danger
          onClick={() => { setOpen(false); setDel(true); }}
        >
          Delete project
        </MenuItem>
      </Popover>
      <DeleteProjectDialog project={p} open={del} onClose={() => setDel(false)} onDeleted={() => router.push("/projects")} />
    </div>
  );
}

function MenuItem({ icon, children, onClick, danger, disabled }: { icon: ReactNode; children: ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button disabled={disabled} onClick={onClick} className={cn("flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-hover disabled:opacity-50", danger ? "text-neg" : "text-ink-2")}>
      <span className="text-muted">{icon}</span>
      {children}
    </button>
  );
}

function Prop({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[32px] items-start gap-2">
      <div className="flex h-[30px] w-[132px] shrink-0 items-center gap-2 text-[13px] text-muted sm:w-[150px]">
        <span className="text-faint">{icon}</span>
        {label}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Properties({ p, set, today }: { p: Project; set: (patch: Partial<Project>) => void; today: string }) {
  const { data: w } = useWallets();
  const [more, setMore] = useState(false);
  const walletLabel = (a: string) => {
    const found = w?.wallets.find((x) => x.address.toLowerCase() === a.toLowerCase());
    return found?.label ? `${found.label} · ${shortAddr(a)}` : shortAddr(a);
  };
  const kd = p.keyDates ?? {};
  const links = p.links ?? {};
  const ic = "h-3.5 w-3.5";
  return (
    <div className="mt-5 grid gap-x-8 gap-y-0.5 md:grid-cols-2">
      <div className="space-y-0.5">
        <Prop icon={<Layers className={ic} />} label="Category"><SelectPill value={p.category} options={CATEGORY_OPTS} onChange={(v) => set({ category: v })} dot={false} /></Prop>
        <Prop icon={<CircleDot className={ic} />} label="Status"><SelectPill value={p.status} options={STATUS_OPTS} onChange={(v) => set({ status: v })} /></Prop>
        <Prop icon={<Flag className={ic} />} label="Priority"><SelectPill value={p.priority} options={PRIORITY_OPTS} onChange={(v) => set({ priority: v })} dot={false} /></Prop>
        <Prop icon={<Gauge className={ic} />} label="Tier / potential"><SelectPill value={p.tier} options={TIER_OPTS.map((t) => ({ ...t, label: t.long }))} onChange={(v) => set({ tier: v })} dot={false} /></Prop>
        <Prop icon={<ShieldAlert className={ic} />} label="Risk"><SelectPill value={p.risk} options={RISK_OPTS} onChange={(v) => set({ risk: v })} /></Prop>
        <Prop icon={<BadgeCheck className={ic} />} label="Eligibility"><SelectPill value={p.eligibility} options={ELIGIBILITY_OPTS} onChange={(v) => set({ eligibility: v })} /></Prop>
        <Prop icon={<Star className={ic} />} label="Rating">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1">
            <Rating value={p.rating} onChange={(v) => set({ rating: v })} />
            <AuditButton p={p} set={set} />
          </div>
        </Prop>
        <Prop icon={<Palette className={ic} />} label="Accent">
          <ColorSelector value={p.accent ?? ""} onValueChange={(v) => set({ accent: v || null })} className="py-1">
            <ColorSelectorList className="flex-nowrap gap-1">
              {ACCENTS.map((a) => <ColorSelectorItem key={a} value={a} color={`var(--t-${a}-fg)`} label={a} className="size-6 [&>span:last-child]:size-3.5" />)}
            </ColorSelectorList>
          </ColorSelector>
        </Prop>
        <Prop icon={<Waypoints className={ic} />} label="Chains"><TagInput value={p.chains} onChange={(v) => set({ chains: v })} suggestions={CHAIN_SUGGESTIONS} placeholder="Empty" allowCreate={false} render={(c) => <ChainLabel chain={c} />} /></Prop>
        <Prop icon={<Tag className={ic} />} label="Tags"><TagInput value={p.tags} onChange={(v) => set({ tags: v })} suggestions={["points", "quests", "galxe", "zealy", "bridge", "swap", "lp", "staking", "node", "social", "gtd", "fcfs", "season-1"]} placeholder="Empty" tone="stone" /></Prop>
        <Prop icon={<WalletIcon className={ic} />} label="Wallets used">
          <TagInput value={p.wallets} onChange={(v) => set({ wallets: v })} suggestions={(w?.wallets ?? []).map((x) => x.address)} render={walletLabel} placeholder="Link wallets" tone="blue" />
        </Prop>
      </div>
      <div className="space-y-0.5">
        <Prop icon={<CalendarDays className={ic} />} label="Deadline">
          <DateCell value={p.deadline} today={today} onSave={(v) => set({ deadline: v })} />
        </Prop>
        {KEY_DATES.map((k) => (
          <Prop key={k.id} icon={<CalendarDays className={ic} />} label={k.label}>
            <DateCell
              value={(kd[k.id as keyof typeof kd] as string | null | undefined) ?? null}
              today={today}
              time={kd.times?.[k.id as keyof NonNullable<typeof kd.times>] ?? null}
              onSave={(v) => set({ keyDates: { ...kd, [k.id]: v, ...(v ? {} : { times: { ...kd.times, [k.id]: null } }) } })}
              onTime={(t) => set({ keyDates: { ...kd, times: { ...kd.times, [k.id]: t } } })}
            />
          </Prop>
        ))}
        <Prop icon={<CalendarRange className={ic} />} label="Campaign">
          <CampaignCell start={p.campaignStart} end={p.campaignEnd} today={today} onSave={(a, b) => set({ campaignStart: a, campaignEnd: b })} />
        </Prop>
        <Prop icon={<Sparkles className={ic} />} label="Source"><InlineText value={p.source} onSave={(v) => set({ source: v || null })} placeholder="Where you found it" /></Prop>
      </div>
      <div className="md:col-span-2">
        <Prop icon={<Link2 className={ic} />} label="Links">
          <LinksCell links={links} onSave={(l) => set({ links: l })} />
        </Prop>
        {more ? (
          <>
            <Prop icon={<AtSign className={ic} />} label="Referral"><InlineText value={p.referral} onSave={(v) => set({ referral: v || null })} placeholder="Your ref code or invite link" /></Prop>
            <Prop icon={<Mail className={ic} />} label="Mail matchers">
              <TagInput value={p.mailMatchers} onChange={(v) => set({ mailMatchers: v })} placeholder="Sender domains or keywords, e.g. monad.xyz" tone="stone" />
            </Prop>
          </>
        ) : (
          <button onClick={() => setMore(true)} className="ml-[140px] mt-1 rounded px-1.5 py-1 text-[12.5px] text-faint hover:bg-hover hover:text-ink-2 sm:ml-[158px]">+ Referral, mail matchers</button>
        )}
      </div>
    </div>
  );
}

function DateCell({ value, onSave, today, time, onTime }: { value: string | null | undefined; onSave: (v: string | null) => void; today: string; time?: string | null; onTime?: (v: string | null) => void }) {
  const c = clockInZone(new Date());
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
      <div className="w-[186px]"><DateField value={value} onSave={onSave} className="text-[13px]" /></div>
      {value && onTime && <TimePicker value={time} onChange={onTime} />}
      {value && <span className="text-[12px] text-faint">{relWhen(value, time, today, c.h * 60 + c.m)}</span>}
    </div>
  );
}

function LinksCell({ links, onSave }: { links: Record<string, string | undefined>; onSave: (l: Record<string, string>) => void }) {
  const [open, setOpen] = useState(false);
  const [btn, setBtn] = useState<HTMLButtonElement | null>(null);
  // Custom names live next to the URLs as "label.<field>" keys (e.g. label.other = "Checker").
  const set = Object.entries(links).filter(([k, v]) => v && !k.startsWith("label."));
  const nameOf = (k: string) => links[`label.${k}`]?.trim() || LINK_FIELDS.find((f) => f.id === k)?.label || k;
  const save = (patch: Record<string, string>) => onSave(Object.fromEntries(Object.entries({ ...links, ...patch }).filter(([, x]) => x)) as Record<string, string>);
  return (
    <div className="flex flex-wrap items-center gap-1 py-0.5">
      {set.map(([k, v]) => (
        <a key={k} href={v!.startsWith("http") ? v : `https://${v}`} target="_blank" rel="noreferrer" title={v} className="inline-flex h-[26px] items-center gap-1.5 rounded-md border border-line bg-panel px-2 text-[12.5px] leading-[1.35] text-ink-2 transition-colors hover:border-line-strong hover:text-ink">
          <LinkIcon field={k} className="h-3.5 w-3.5" />
          {nameOf(k)}
        </a>
      ))}
      <button ref={setBtn} onClick={() => setOpen((o) => !o)} className="inline-flex h-[24px] items-center gap-1 rounded-md px-1.5 text-[12.5px] text-faint hover:bg-hover hover:text-ink-2">
        {set.length ? "Edit" : <><Plus className="h-3 w-3" /> Add links</>}
      </button>
      <Popover anchor={btn} open={open} onClose={() => setOpen(false)} width={380}>
        <div className="space-y-1.5 p-1.5">
          <div className="flex items-center gap-2 px-0.5 font-label text-[10.5px] uppercase tracking-[0.12em] text-faint"><span className="w-[118px]">Name</span><span>Link</span></div>
          {LINK_FIELDS.map((f) => (
            <div key={f.id} className="flex items-center gap-2">
              <span className="flex w-[118px] shrink-0 items-center gap-1.5 rounded-md border border-line bg-panel pl-1.5 focus-within:ring-2 focus-within:ring-[var(--ring)]">
                <LinkIcon field={f.id} className="h-3 w-3 shrink-0 text-muted" />
                <input
                  defaultValue={links[`label.${f.id}`] ?? ""}
                  aria-label={`${f.label} name`}
                  maxLength={24}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v === (links[`label.${f.id}`] ?? "")) return;
                    save({ [`label.${f.id}`]: v === f.label ? "" : v });
                  }}
                  placeholder={f.label}
                  className="h-7 w-full min-w-0 bg-transparent pr-1.5 text-[12.5px] text-ink outline-none placeholder:text-muted no-ring"
                />
              </span>
              <input
                defaultValue={links[f.id] ?? ""}
                aria-label={`${f.label} URL`}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v === (links[f.id] ?? "")) return;
                  save({ [f.id]: v });
                }}
                placeholder="https://"
                className="h-7 min-w-0 flex-1 rounded-md border border-line bg-panel px-2 text-[12.5px] outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>
          ))}
          <p className="px-0.5 pt-0.5 text-[11.5px] text-faint">Rename any link, e.g. Other → Checker. The icon stays.</p>
        </div>
      </Popover>
    </div>
  );
}

function MoneyStrip({ p, money, set }: { p: Project; money: ReturnType<typeof projectPnl>; set: (patch: Partial<Project>) => void }) {
  const cell = "rounded-lg border border-line bg-panel px-3 py-2.5";
  const label = "text-[11.5px] font-medium text-muted";
  const toNum = (v: string) => {
    const n = Number(v.replace(/[$,\s]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };
  return (
    <div className="mt-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className={cell}>
          <div className={label}>Invested</div>
          <div className="num mt-0.5 text-[18px]">{usd(money.invested)}</div>
        </div>
        <div className={cell}>
          <div className={label}>Realized</div>
          <div className={cn("num mt-0.5 text-[18px]", tone(money.realized))}>{usd(money.realized, { sign: true })}</div>
        </div>
        <div className={cell}>
          <div className={label}>Unrealized</div>
          <div className={cn("num mt-0.5 text-[18px]", tone(money.unrealized))}>{usd(money.unrealized, { sign: true })}</div>
        </div>
        <div className={cn(cell, "relative overflow-hidden")}>
          <div className={label}>Net PnL · ROI</div>
          <div className="flex items-baseline gap-2">
            <span className={cn("num mt-0.5 text-[18px]", tone(money.net))}>{usd(money.net, { sign: true })}</span>
            <span className={cn("num text-[12.5px]", tone(money.roi))}>{pct(money.roi)}</span>
          </div>
        </div>
      </div>
      <div className="mt-2 grid gap-x-6 gap-y-0.5 sm:grid-cols-3">
        <Prop icon={<Coins className="h-3.5 w-3.5" />} label="Gas & fees ($)"><InlineText mono value={p.costSpent || ""} placeholder="0" onSave={(v) => set({ costSpent: toNum(v) })} /></Prop>
        <Prop icon={<Banknote className="h-3.5 w-3.5" />} label="Capital (modal)"><InlineText mono value={p.capitalDeployed || ""} placeholder="0" onSave={(v) => set({ capitalDeployed: toNum(v) })} /></Prop>
        <Prop icon={<Sparkles className="h-3.5 w-3.5" />} label="Rewards ($)"><InlineText mono value={p.rewardsReceived || ""} placeholder="0" onSave={(v) => set({ rewardsReceived: toNum(v) })} /></Prop>
      </div>
      <p className="mt-1 text-[11.5px] text-faint">Capital is money parked outside tracked positions (deposits, LP, mint cost). Net = rewards + position PnL − gas. ROI = net ÷ invested.</p>
    </div>
  );
}

function Positions({ projectId, positions }: { projectId: string; positions: Position[] }) {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: keys.project(projectId) });
    qc.invalidateQueries({ queryKey: keys.projects });
  };
  const patch = async (id: string, body: Partial<Position>) => {
    try {
      await api(`/api/positions/${id}`, { method: "PATCH", body });
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const remove = async (id: string) => {
    await api(`/api/positions/${id}`, { method: "DELETE" });
    refresh();
  };
  const refreshPrices = async () => {
    setRefreshing(true);
    try {
      const r = await api<{ checked: number; updated: number }>("/api/positions/refresh", { method: "POST", body: { projectId } });
      toast.success(r.checked ? `Updated ${r.updated} of ${r.checked} open positions from DexScreener` : "Add a token address to open positions to auto-price them.");
      refresh();
    } finally {
      setRefreshing(false);
    }
  };
  const n = (v: string) => (v.trim() === "" ? null : Number(v.replace(/[$,\s]/g, "")));
  const th = "h-8 whitespace-nowrap px-2 text-left text-[12px] font-medium text-muted";
  const td = "h-10 border-t border-line px-1 align-middle";
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[13px] text-muted">Each entry is a buy (or mint) you made. Close it with an exit price to realize PnL.</p>
        <Button size="sm" variant="ghost" onClick={refreshPrices} disabled={refreshing}>
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} /> Refresh prices
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-line bg-panel">
        <table className="w-full min-w-[880px] border-collapse">
          <thead>
            <tr>
              <th className={cn(th, "pl-3")}>Token</th>
              <th className={th}>Chain</th>
              <th className={cn(th, "text-right")}>Size</th>
              <th className={cn(th, "text-right")}>Entry</th>
              <th className={cn(th, "text-right")}>Current / Exit</th>
              <th className={th}>Status</th>
              <th className={cn(th, "text-right")}>Cost</th>
              <th className={cn(th, "text-right")}>PnL</th>
              <th className={cn(th, "text-right")}>ROI</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {positions.map((x) => {
              const r = positionPnl(x);
              const closed = x.status === "closed";
              return (
                <tr key={x.id} className="group">
                  <td className={cn(td, "pl-2")}>
                    <InlineText value={x.token} onSave={(v) => v && patch(x.id, { token: v })} className="font-medium" />
                    <InlineText value={x.tokenAddress} onSave={(v) => patch(x.id, { tokenAddress: v || null })} placeholder="token address" mono className="h-5 min-h-0 text-[11px] text-faint" />
                  </td>
                  <td className={td}><span className="flex items-center gap-1.5">{x.chain && <ChainLogo chain={x.chain} size={14} fallback />}<InlineText value={x.chain} onSave={(v) => patch(x.id, { chain: v || null })} placeholder="—" /></span></td>
                  <td className={cn(td, "text-right")}><InlineText mono value={x.size} onSave={(v) => patch(x.id, { size: n(v) ?? 0 })} className="justify-end" /></td>
                  <td className={cn(td, "text-right")}><InlineText mono value={x.entryPrice} onSave={(v) => patch(x.id, { entryPrice: n(v) ?? 0 })} className="justify-end" /></td>
                  <td className={cn(td, "text-right")}>
                    {closed ? (
                      <InlineText mono value={x.exitPrice} placeholder="exit" onSave={(v) => patch(x.id, { exitPrice: n(v) })} className="justify-end" />
                    ) : (
                      <InlineText mono value={x.currentPrice} placeholder="current" onSave={(v) => patch(x.id, { currentPrice: n(v) })} className="justify-end" />
                    )}
                  </td>
                  <td className={td}>
                    <SelectPill
                      value={x.status}
                      options={[{ id: "open", label: "Open", tone: "blue" }, { id: "closed", label: "Closed", tone: "stone" }]}
                      onChange={(v) => patch(x.id, v === "closed" ? { status: v, exitPrice: x.exitPrice ?? x.currentPrice, closedAt: todayFn() } : { status: v })}
                    />
                  </td>
                  <td className={cn(td, "num pr-2 text-right text-[13px] text-ink-2")}>{usd(r.costBasis)}</td>
                  <td className={cn(td, "num pr-2 text-right text-[13px]", tone(closed ? r.realized : r.unrealized))}>{r.value == null ? "—" : usd(closed ? r.realized : r.unrealized, { sign: true })}</td>
                  <td className={cn(td, "num pr-2 text-right text-[13px]", tone(r.roi))}>{pct(r.roi)}</td>
                  <td className={cn(td, "w-8")}>
                    <button onClick={() => remove(x.id)} className="rounded p-1 text-faint opacity-0 hover:text-neg group-hover:opacity-100" aria-label="Delete position"><Trash2 className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <AddPosition projectId={projectId} onDone={refresh} />
      </div>
      {positions.length > 0 && <p className="mt-2 text-[11.5px] text-faint">Prices refresh from DexScreener for open positions with a token address. Last update: {positions.map((x) => x.priceUpdatedAt).filter(Boolean).sort().pop() ? new Date(positions.map((x) => x.priceUpdatedAt).filter(Boolean).sort().pop()!).toLocaleString() : "never"}.</p>}
    </div>
  );
}

function AddPosition({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const [f, setF] = useState({ token: "", chain: "", size: "", entryPrice: "", currentPrice: "", tokenAddress: "" });
  const ok = f.token.trim() && f.size && f.entryPrice;
  const submit = async () => {
    if (!ok) return;
    try {
      await api("/api/positions", {
        method: "POST",
        body: { projectId, token: f.token.trim(), chain: f.chain || null, size: Number(f.size), entryPrice: Number(f.entryPrice), currentPrice: f.currentPrice ? Number(f.currentPrice) : null, tokenAddress: f.tokenAddress || null, status: "open", openedAt: todayFn() },
      });
      setF({ token: "", chain: "", size: "", entryPrice: "", currentPrice: "", tokenAddress: "" });
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const inp = "h-8 rounded-md border border-line bg-bg px-2 text-[13px] outline-none placeholder:text-faint focus:ring-2 focus:ring-[var(--ring)]";
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex flex-wrap items-center gap-1.5 border-t border-line p-2">
      <Plus className="ml-1 h-3.5 w-3.5 text-faint" />
      <input className={cn(inp, "w-[110px]")} placeholder="Token" value={f.token} onChange={(e) => setF({ ...f, token: e.target.value })} />
      <input className={cn(inp, "w-[90px]")} placeholder="Chain" value={f.chain} onChange={(e) => setF({ ...f, chain: e.target.value })} />
      <input className={cn(inp, "num w-[100px]")} placeholder="Size" inputMode="decimal" value={f.size} onChange={(e) => setF({ ...f, size: e.target.value })} />
      <input className={cn(inp, "num w-[110px]")} placeholder="Entry $" inputMode="decimal" value={f.entryPrice} onChange={(e) => setF({ ...f, entryPrice: e.target.value })} />
      <input className={cn(inp, "num w-[110px]")} placeholder="Current $" inputMode="decimal" value={f.currentPrice} onChange={(e) => setF({ ...f, currentPrice: e.target.value })} />
      <input className={cn(inp, "num min-w-[140px] flex-1")} placeholder="Token address (auto price)" value={f.tokenAddress} onChange={(e) => setF({ ...f, tokenAddress: e.target.value })} />
      <Button size="sm" variant="primary" type="submit" disabled={!ok}>Add position</Button>
    </form>
  );
}

function ProjectTasks({ projectId }: { projectId: string }) {
  const model = useTaskModel(projectId);
  const qc = useQueryClient();
  return (
    <div className="space-y-3">
      {model.rows.length > 0 && (
        <div className="rounded-lg border border-line bg-panel p-1">
          {model.rows.map((r) => (
            <TaskRow
              key={r.task.id}
              row={r}
              showProject={false}
              onDelete={async () => {
                await api(`/api/tasks/${r.task.id}`, { method: "DELETE" });
                qc.invalidateQueries({ queryKey: keys.tasks });
              }}
            />
          ))}
        </div>
      )}
      <AddTask projectId={projectId} compact />
    </div>
  );
}

function ProjectDiary({ projectId, entries }: { projectId: string; entries: { id: string; day: string; title: string; content: string }[] }) {
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Link href={`/diary?new=1&project=${projectId}`}><Button size="sm"><Plus className="h-3.5 w-3.5" /> New entry for this project</Button></Link>
      </div>
      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line py-8 text-center text-[13px] text-muted">No diary entries tagged with this project yet.</div>
      ) : (
        <div className="space-y-3">
          {entries.map((e) => (
            <Link key={e.id} href={`/diary?entry=${e.id}`} className="block rounded-lg border border-line bg-panel p-4 transition-colors hover:border-line-strong">
              <div className="num text-[11.5px] text-muted">{new Date(e.day + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</div>
              {e.title && <div className="mt-0.5 font-serif text-[18px]">{e.title}</div>}
              <div className="mt-1 line-clamp-3 text-[13.5px] text-ink-2">{e.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || "Empty entry"}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}


const ACCENTS = ["amber", "red", "green", "blue", "violet", "stone"] as const;

function AuditButton({ p, set }: { p: Project; set: (patch: Partial<Project>) => void }) {
  const [open, setOpen] = useState(false);
  const [seed, setSeed] = useState<{ answers: Record<string, string[]>; n: number } | null>(null);
  const ai = p.audit?.ai ?? null;
  const accept = (r: AiReview, withTierRisk: boolean) => {
    const base = p.audit ?? { answers: r.answers, score: r.score, updatedAt: new Date().toISOString() };
    set({
      rating: r.rating,
      audit: { ...base, ai: r },
      ...(withTierRisk && r.tier ? { tier: r.tier } : {}),
      ...(withTierRisk && r.risk ? { risk: r.risk } : {}),
    });
    toast.success(`Rating set to ${r.rating}★ from the AI review`);
  };
  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded px-1.5 py-0.5 text-[12px] leading-[1.4] text-muted hover:bg-hover hover:text-ink">
        {p.audit ? <>Audit <span className="num text-ink-2">{p.audit.score}</span>/100</> : "Run audit"}
      </button>
      <button onClick={() => setOpen(true)} title="AI review" className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[12px] leading-[1.4] text-accent hover:bg-hover">
        <Sparkles className="h-3 w-3" /> {ai ? <>AI {ai.rating}★</> : "AI review"}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Project audit" width={600}>
        <div className="mb-4">
          <AiReviewPanel
            projectId={p.id}
            saved={ai}
            onAcceptRating={accept}
            onUseAnswers={(r) => {
              setSeed((s) => ({ answers: r.answers, n: (s?.n ?? 0) + 1 }));
              toast.success("AI answers filled in below. Review and save.");
            }}
          />
        </div>
        <Questionnaire
          key={seed?.n ?? 0}
          questions={AUDIT.map((q) => ({ id: q.id, title: q.title, help: q.help, options: q.options.map((o) => ({ id: o.id, label: o.label })) }))}
          initial={seed?.answers ?? p.audit?.answers ?? {}}
          submitLabel="Save audit"
          onCancel={() => setOpen(false)}
          onSubmit={(answers) => {
            const score = auditScore(answers);
            set({ audit: { answers, score, updatedAt: new Date().toISOString(), ai: p.audit?.ai ?? null }, ...(p.rating ? {} : { rating: scoreToRating(score) }) });
            setOpen(false);
            toast.success(`Audit saved · ${score}/100`);
          }}
        />
      </Dialog>
    </>
  );
}

const fmtShort = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

/** Campaign window picked on two wheels (beUI Wheel Picker), ±1 year around today. */
function CampaignCell({ start, end, today, onSave }: { start: string | null; end: string | null; today: string; onSave: (a: string | null, b: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [a, setA] = useState(start ?? today);
  const [b, setB] = useState(end ?? addDays(start ?? today, 30));
  const options = (() => {
    const out: { label: string; value: string }[] = [];
    for (let i = -365; i <= 365; i++) {
      const d = addDays(today, i);
      out.push({ label: fmtShort(d), value: d });
    }
    return out;
  })();
  const days = start && end ? Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000) : null;
  return (
    <>
      <div className="flex items-center gap-0.5">
      <button onClick={() => { setA(start ?? today); setB(end ?? addDays(start ?? today, 30)); setOpen(true); }} className="min-h-[28px] rounded px-1.5 py-1 text-left text-[13px] hover:bg-hover">
        {start || end ? (
          <span className="num text-ink-2">{start ? fmtShort(start) : "…"} → {end ? fmtShort(end) : "…"}{days != null && <span className="ml-2 text-faint">{days}d</span>}</span>
        ) : (
          <span className="text-faint">Empty</span>
        )}
      </button>
      {(start || end) && (
        <button type="button" onClick={() => onSave(null, null)} className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-faint hover:bg-hover hover:text-ink [@media(hover:hover)]:h-7 [@media(hover:hover)]:w-7" aria-label="Clear campaign dates" title="Clear dates">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title="Campaign window" width={520}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="mb-1 font-label text-[11px] uppercase tracking-[0.14em] text-muted">Starts</div>
            <WheelPicker options={options} value={a} onValueChange={setA} aria-label="Campaign start" />
          </div>
          <div>
            <div className="mb-1 font-label text-[11px] uppercase tracking-[0.14em] text-muted">Ends</div>
            <WheelPicker options={options} value={b} onValueChange={setB} aria-label="Campaign end" />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => { onSave(null, null); setOpen(false); }}>Clear</Button>
          <Button variant="primary" size="sm" disabled={b < a} onClick={() => { onSave(a, b); setOpen(false); }}>{b < a ? "End is before start" : "Save"}</Button>
        </div>
      </Dialog>
    </>
  );
}
