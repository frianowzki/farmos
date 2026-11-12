"use client";
import { Command } from "cmdk";
import {
  ArrowRight, CalendarRange, Flame, FlaskConical, Gift, Image as ImageIcon, Layers, ListChecks, Lock, Mail, Menu, Monitor, Moon, Newspaper, NotebookPen,
  PanelLeftClose, PanelLeftOpen, Plus, Search, Settings2, Sparkles, Sun, SunMedium, Telescope, Wallet, ChartNoAxesColumn, BellRing, Coins,
} from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { motion } from "motion/react";
import { useMounted } from "@/lib/client/use-mounted";
import { playUi } from "@/lib/client/sound";
import { toast } from "@/lib/client/toast";
import { Button, Dialog, Field, Input, Kbd, TagInput } from "@/components/ui";
import {
  AnimatedSidebar, AnimatedSidebarContent, AnimatedSidebarFooter, AnimatedSidebarGroup, AnimatedSidebarGroupLabel, AnimatedSidebarHeader,
  AnimatedSidebarInset, AnimatedSidebarMenu, AnimatedSidebarMenuButton, AnimatedSidebarMenuItem, AnimatedSidebarProvider, AnimatedSidebarTrigger,
  useAnimatedSidebar,
} from "@/components/motion/animated-sidebar";
import { MorphingModal } from "@/components/motion/morphing-modal";
import { Tabs, TabsList, TabsTrigger } from "@/components/motion/tabs";
import { Fab } from "@/components/panelui/fab";
import { ChainLabel } from "@/components/chain-logo";
import { AddTask } from "@/components/tasks";
import { ShortcutHelp } from "@/components/shortcut-help";
import { cn } from "@/lib/cn";
import { CHAIN_SUGGESTIONS, CATEGORIES } from "@/lib/constants";
import { api, useCreateProject, useProjects, useWallets } from "@/lib/client/api";
import { shortAddr } from "@/lib/format";
import { CATEGORY_OPTS } from "@/lib/options";

type ShellCtx = { newProject: (category?: string) => void; openPalette: () => void; openQuick: () => void };
const Ctx = createContext<ShellCtx>({ newProject: () => {}, openPalette: () => {}, openQuick: () => {} });
export const useShell = () => useContext(Ctx);

export const CAT_ICON: Record<string, typeof Gift> = { airdrop: Gift, testnet: FlaskConical, nft: ImageIcon, degen: Flame };

const NAV_TOP = [
  { href: "/", label: "Today", icon: SunMedium },
  { href: "/recap", label: "Recap", icon: CalendarRange },
  { href: "/feed", label: "Feed", icon: Newspaper },
];

const NAV = [
  { href: "/tasks", label: "Daily tasks", icon: ListChecks },
  { href: "/diary", label: "Diary", icon: NotebookPen },
  { href: "/portfolio", label: "Portfolio", icon: ChartNoAxesColumn },
  { href: "/money", label: "Money", icon: Coins },
  { href: "/mints", label: "Upcoming mints", icon: Sparkles },
  { href: "/watchlist", label: "Watchlist", icon: BellRing },
  { href: "/mail", label: "Mail", icon: Mail },
  { href: "/assistant", label: "Research desk", icon: Telescope },
  { href: "/wallets", label: "Wallets", icon: Wallet },
];

export { Monogram } from "@/components/project-mark";
import { ProjectMark } from "@/components/project-mark";

export function Logo({ className, mark = false }: { className?: string; mark?: boolean }) {
  // Brand logo (sprout + wordmark), vector-traced from the master PNG; a light-green variant for dark mode.
  // `mark` renders the sprout glyph on its own (square-ish), for compact/branding spots such as the login page.
  return (
    <span className={cn("inline-flex h-[26px] select-none items-center", className)} role="img" aria-label="farmOS">
      {mark ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/farmos-sprout.svg" alt="" width={26} height={34} className="h-full w-auto dark:hidden" draggable={false} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/farmos-sprout-dark.svg" alt="" width={26} height={34} className="hidden h-full w-auto dark:block" draggable={false} />
        </>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/farmos-logo.svg" alt="" width={90} height={26} className="h-full w-auto dark:hidden" draggable={false} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/farmos-logo-dark.svg" alt="" width={90} height={26} className="hidden h-full w-auto dark:block" draggable={false} />
        </>
      )}
    </span>
  );
}

function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const opts = [
    { id: "light", icon: Sun, label: "Light" },
    { id: "dark", icon: Moon, label: "Dark" },
    { id: "system", icon: Monitor, label: "Auto" },
  ];
  return (
    <div className="flex items-center rounded-md border border-line bg-panel p-0.5" role="radiogroup" aria-label="Theme">
      {opts.map((o) => (
        <button
          key={o.id}
          role="radio"
          aria-checked={mounted && theme === o.id}
          title={o.label}
          onClick={() => { setTheme(o.id); playUi("toggle"); }}
          className={cn("relative flex h-6 flex-1 items-center justify-center gap-1 rounded-[5px] px-2 text-[11.5px] text-muted transition-colors", mounted && theme === o.id ? "text-ink" : "hover:text-ink")}
        >
          {mounted && theme === o.id && <motion.span layoutId="theme-pill" className="absolute inset-0 rounded-[5px] bg-active" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
          <o.icon className="relative h-3.5 w-3.5" />
          <span className="relative hidden lg:inline">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

function useSidebarPref() {
  const KEY = "frioos-sidebar";
  const open = useSyncExternalStore(
    (cb) => { window.addEventListener("storage", cb); window.addEventListener("frioos-sidebar", cb); return () => { window.removeEventListener("storage", cb); window.removeEventListener("frioos-sidebar", cb); }; },
    () => window.localStorage.getItem(KEY) !== "closed",
    () => true,
  );
  const set = (v: boolean) => { window.localStorage.setItem(KEY, v ? "open" : "closed"); window.dispatchEvent(new Event("frioos-sidebar")); };
  return [open, set] as const;
}

function CompactTheme() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const order = ["light", "dark", "system"] as const;
  const cur = mounted ? (theme as (typeof order)[number]) ?? "system" : "system";
  const Icon = cur === "light" ? Sun : cur === "dark" ? Moon : Monitor;
  return (
    <button
      type="button"
      title={`Theme: ${cur === "system" ? "Auto" : cur}`}
      aria-label="Cycle theme"
      onClick={() => { setTheme(order[(order.indexOf(cur) + 1) % 3]); playUi("toggle"); }}
      className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-hover hover:text-ink"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function SidebarBody() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const { data } = useProjects();
  const { openPalette } = useShell();
  const { state, isMobile, toggleSidebar } = useAnimatedSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0 };
    for (const p of data?.projects ?? []) {
      if (p.status === "done" || p.status === "dropped") continue;
      c.all++;
      c[p.category] = (c[p.category] ?? 0) + 1;
    }
    return c;
  }, [data]);
  // Counts and pins come from the client cache; render them only after mount so SSR and hydration agree.
  const ready = useMounted();
  const pinned = ready ? (data?.projects ?? []).filter((p) => p.pinned).slice(0, 8) : [];
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const cat = pathname === "/projects" ? sp.get("cat") ?? "all" : null;
  const icon = (I: typeof Gift) => <I className="h-[17px] w-[17px]" strokeWidth={1.75} />;
  const badge = (n?: number) => (n && ready ? <span className="num text-[11px] text-faint">{n}</span> : undefined);
  const btn = "min-h-[32px] rounded-lg px-2.5 text-[13.5px] font-normal text-ink-2 hover:text-ink";

  return (
    <>
      <AnimatedSidebarHeader className="gap-2 px-3 pb-1 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between")}>
          {!collapsed && (
            <Link href="/" className="rounded px-1">
              <Logo />
            </Link>
          )}
          {!isMobile && (
            <button type="button" onClick={toggleSidebar} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={`${collapsed ? "Expand" : "Collapse"} (⌘B)`} className="rounded-md p-1.5 text-muted hover:bg-hover hover:text-ink">
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          )}
        </div>
        {collapsed ? (
          <button type="button" onClick={openPalette} aria-label="Search" className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-hover hover:text-ink">
            <Search className="h-4 w-4" />
          </button>
        ) : (
          <button type="button" onClick={openPalette} className="flex h-9 w-full min-w-0 items-center gap-2 overflow-hidden rounded-lg border border-line bg-panel px-2.5 text-[13px] leading-[1.4] text-muted transition-colors hover:border-line-strong">
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate py-0.5 text-left">Search…</span>
            <span className="shrink-0"><Kbd>⌘K</Kbd></span>
          </button>
        )}
      </AnimatedSidebarHeader>
      <AnimatedSidebarContent className="gap-0 px-1.5">
        <AnimatedSidebarGroup>
          <AnimatedSidebarMenu>
            {NAV_TOP.map((n) => (
              <AnimatedSidebarMenuItem key={n.href}>
                <AnimatedSidebarMenuButton href={n.href} isActive={isActive(n.href)} icon={icon(n.icon)} className={btn}>{n.label}</AnimatedSidebarMenuButton>
              </AnimatedSidebarMenuItem>
            ))}
          </AnimatedSidebarMenu>
        </AnimatedSidebarGroup>
        <AnimatedSidebarGroup>
          <AnimatedSidebarGroupLabel className="font-label text-[10.5px] text-faint">Projects</AnimatedSidebarGroupLabel>
          <AnimatedSidebarMenu>
            <AnimatedSidebarMenuItem>
              <AnimatedSidebarMenuButton href="/projects" isActive={cat === "all"} icon={icon(Layers)} badge={badge(counts.all)} className={btn}>All projects</AnimatedSidebarMenuButton>
            </AnimatedSidebarMenuItem>
            {CATEGORIES.map((c) => (
              <AnimatedSidebarMenuItem key={c.id}>
                <AnimatedSidebarMenuButton href={`/projects?cat=${c.id}`} isActive={cat === c.id} icon={icon(CAT_ICON[c.id])} badge={badge(counts[c.id])} className={btn}>{c.label}</AnimatedSidebarMenuButton>
              </AnimatedSidebarMenuItem>
            ))}
          </AnimatedSidebarMenu>
        </AnimatedSidebarGroup>
        <AnimatedSidebarGroup>
          <AnimatedSidebarGroupLabel className="font-label text-[10.5px] text-faint">Workspace</AnimatedSidebarGroupLabel>
          <AnimatedSidebarMenu>
            {NAV.map((n) => (
              <AnimatedSidebarMenuItem key={n.href}>
                <AnimatedSidebarMenuButton href={n.href} isActive={isActive(n.href)} icon={icon(n.icon)} className={btn}>{n.label}</AnimatedSidebarMenuButton>
              </AnimatedSidebarMenuItem>
            ))}
          </AnimatedSidebarMenu>
        </AnimatedSidebarGroup>
        {pinned.length > 0 && !collapsed && (
          <AnimatedSidebarGroup>
            <AnimatedSidebarGroupLabel className="font-label text-[10.5px] text-faint">Pinned</AnimatedSidebarGroupLabel>
            <AnimatedSidebarMenu>
              {pinned.map((p) => (
                <AnimatedSidebarMenuItem key={p.id}>
                  <AnimatedSidebarMenuButton href={`/projects/${p.id}`} isActive={pathname === `/projects/${p.id}`} icon={<ProjectMark p={p} size={18} />} className={btn}>{p.name}</AnimatedSidebarMenuButton>
                </AnimatedSidebarMenuItem>
              ))}
            </AnimatedSidebarMenu>
          </AnimatedSidebarGroup>
        )}
      </AnimatedSidebarContent>
      <AnimatedSidebarFooter className="gap-2 border-line p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <AnimatedSidebarMenu>
          <AnimatedSidebarMenuItem>
            <AnimatedSidebarMenuButton href="/settings" isActive={isActive("/settings")} icon={icon(Settings2)} className={btn}>Settings</AnimatedSidebarMenuButton>
          </AnimatedSidebarMenuItem>
          <AnimatedSidebarMenuItem>
            <AnimatedSidebarMenuButton
              icon={icon(Lock)}
              className={btn}
              onSelect={async () => {
                await api("/api/unlock", { method: "DELETE" });
                // full reload so every cached query is dropped
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                window.location.href = "/login";
              }}
            >
              Lock
            </AnimatedSidebarMenuButton>
          </AnimatedSidebarMenuItem>
        </AnimatedSidebarMenu>
        {collapsed ? <CompactTheme /> : <ThemeSwitch />}
      </AnimatedSidebarFooter>
    </>
  );
}

function NewProjectForm({ initialCategory, onDone }: { initialCategory?: string; onDone: () => void }) {
  const router = useRouter();
  const create = useCreateProject();
  const [name, setName] = useState("");
  const [category, setCategory] = useState(initialCategory ?? "airdrop");
  const [chains, setChains] = useState<string[]>([]);
  const [site, setSite] = useState("");
  const [x, setX] = useState("");
  const submit = async () => {
    if (!name.trim()) return;
    try {
      const links: Record<string, string> = {};
      if (site.trim()) links.site = site.trim();
      if (x.trim()) links.x = x.trim().startsWith("http") ? x.trim() : `https://x.com/${x.trim().replace(/^@/, "")}`;
      const { project } = await create.mutateAsync({ name: name.trim(), category, chains, links, status: "research" });
      onDone();
      toast.success(`${project.name} added`);
      router.push(`/projects/${project.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <form className="space-y-3.5" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <h2 className="font-serif text-[22px] leading-tight text-ink">New project</h2>
      <Input autoFocus placeholder="Project name, e.g. Monad testnet" value={name} onChange={(e) => setName(e.target.value)} className="h-10 text-[15px]" />
      <Tabs value={category} onValueChange={setCategory} variant="segment">
        <TabsList className="grid w-full grid-cols-4">
          {CATEGORY_OPTS.map((c) => {
            const Icon = CAT_ICON[c.id];
            return <TabsTrigger key={c.id} value={c.id} icon={<Icon className="h-3.5 w-3.5" />}>{c.label}</TabsTrigger>;
          })}
        </TabsList>
      </Tabs>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Website"><Input placeholder="https://" value={site} onChange={(e) => setSite(e.target.value)} /></Field>
        <Field label="X handle"><Input placeholder="@project" value={x} onChange={(e) => setX(e.target.value)} /></Field>
      </div>
      <Field label="Chains">
        <div className="rounded-md border border-line px-1"><TagInput value={chains} onChange={setChains} suggestions={CHAIN_SUGGESTIONS} placeholder="Add chains" allowCreate={false} render={(c) => <ChainLabel chain={c} />} /></div>
      </Field>
      <div className="flex items-center justify-between pt-1">
        <span className="text-[12px] text-faint">Everything else lives on the project page.</span>
        <Button variant="primary" type="submit" loading={create.isPending} disabled={!name.trim()}>Create <ArrowRight className="h-3.5 w-3.5" /></Button>
      </div>
    </form>
  );
}

type QuickView = "menu" | "project" | "task" | null;

function QuickAdd({ view, setView, category }: { view: QuickView; setView: (v: QuickView) => void; category?: string }) {
  const router = useRouter();
  const close = () => setView(null);
  const choices = [
    { id: "project" as const, label: "Project", hint: "Airdrop, testnet, NFT or degen play", icon: Layers },
    { id: "task" as const, label: "Daily task", hint: "Something you repeat on a schedule", icon: ListChecks },
    { id: "diary", label: "Diary entry", hint: "What you did today, tagged to projects", icon: NotebookPen, href: "/diary?new=1" },
    { id: "ask", label: "Ask the research desk", hint: "Today's promising projects", icon: Telescope, href: "/assistant?mode=daily" },
  ];
  return (
    <MorphingModal viewId={view} onClose={close} placement="center" className="max-w-[520px] rounded-2xl border-line bg-panel">
      {view === "menu" && (
        <div>
          <h2 className="font-serif text-[22px] leading-tight text-ink">Add something</h2>
          <p className="mt-1 text-[13px] text-muted">Pick what you&apos;re adding.</p>
          <ul className="mt-4 space-y-1">
            {choices.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => ("href" in c && c.href ? (close(), router.push(c.href)) : setView(c.id as QuickView))}
                  className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-bg text-ink-2"><c.icon className="h-4 w-4" strokeWidth={1.75} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] text-ink">{c.label}</span>
                    <span className="block text-[12.5px] text-muted">{c.hint}</span>
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-faint" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {view === "project" && <NewProjectForm initialCategory={category} onDone={close} />}
      {view === "task" && (
        <div className="space-y-3">
          <h2 className="font-serif text-[22px] leading-tight text-ink">New daily task</h2>
          <AddTask autoFocus />
          <div className="flex justify-end"><Button variant="ghost" onClick={close}>Done</Button></div>
        </div>
      )}
    </MorphingModal>
  );
}

function Palette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const { data } = useProjects();
  const wallets = useWallets().data?.wallets;
  const { newProject } = useShell();
  const go = (href: string) => {
    onClose();
    router.push(href);
  };
  const itemCls = "flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-[13.5px] text-ink-2 data-[selected=true]:bg-hover data-[selected=true]:text-ink";
  const group = "[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:text-[11.5px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-faint";
  return (
    <Dialog open={open} onClose={onClose} width={600} bare className="anchor-top">
      <Command label="Command palette">
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Search className="h-4 w-4 text-muted" />
          <Command.Input autoFocus placeholder="Search projects, pages, actions…" className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint" />
          <Kbd>esc</Kbd>
        </div>
        <Command.List className="max-h-[52vh] overflow-y-auto p-1.5">
          <Command.Empty className="px-3 py-6 text-center text-[13px] text-muted">No results.</Command.Empty>
          <Command.Group heading="Create" className={group}>
            <Command.Item className={itemCls} onSelect={() => { onClose(); newProject(); }}>
              <Plus className="h-4 w-4 text-muted" /> New project <span className="ml-auto"><Kbd>N</Kbd></span>
            </Command.Item>
            <Command.Item className={itemCls} onSelect={() => go("/tasks?new=1")}>
              <ListChecks className="h-4 w-4 text-muted" /> New daily task
            </Command.Item>
            <Command.Item className={itemCls} onSelect={() => go("/diary?new=1")}>
              <NotebookPen className="h-4 w-4 text-muted" /> New diary entry
            </Command.Item>
            <Command.Item className={itemCls} onSelect={() => go("/assistant?mode=daily")}>
              <Telescope className="h-4 w-4 text-muted" /> Ask for today&apos;s promising projects
            </Command.Item>
          </Command.Group>
          {(data?.projects?.length ?? 0) > 0 && (
            <Command.Group heading="Projects" className={group}>
              {data!.projects.map((p) => (
                <Command.Item key={p.id} value={`${p.name} ${p.category} ${p.tags.join(" ")}`} className={itemCls} onSelect={() => go(`/projects/${p.id}`)}>
                  <ProjectMark p={p} size={18} /> {p.name}
                  <span className="ml-auto text-[12px] capitalize text-faint">{p.category}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}
          {(wallets?.length ?? 0) > 0 && (
            <Command.Group heading="Wallets" className={group}>
              {wallets!.map((w) => (
                <Command.Item key={w.id} value={`${w.label} ${w.address} ${w.chain} ${w.provider}`} className={itemCls} onSelect={() => go(`/wallets?w=${w.id}`)}>
                  <Wallet className="h-4 w-4 text-muted" />
                  <span className="truncate">{w.label || shortAddr(w.address)}</span>
                  <span className="num ml-auto shrink-0 text-[11.5px] text-faint">{w.chain || "evm"}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}
          <Command.Group heading="Go to" className={group}>
            {[...NAV_TOP, ...NAV, { href: "/projects", label: "All projects", icon: Layers }, { href: "/settings", label: "Settings", icon: Settings2 }].map((n) => (
              <Command.Item key={n.href} className={itemCls} onSelect={() => go(n.href)}>
                <n.icon className="h-4 w-4 text-muted" /> {n.label}
              </Command.Item>
            ))}
            {CATEGORIES.map((c) => {
              const Icon = CAT_ICON[c.id];
              return (
                <Command.Item key={c.id} className={itemCls} onSelect={() => go(`/projects?cat=${c.id}`)}>
                  <Icon className="h-4 w-4 text-muted" /> {c.label} projects
                </Command.Item>
              );
            })}
          </Command.Group>
          <Command.Group heading="Theme" className={group}>
            <Command.Item className={itemCls} onSelect={() => { setTheme("light"); onClose(); }}><Sun className="h-4 w-4 text-muted" /> Light</Command.Item>
            <Command.Item className={itemCls} onSelect={() => { setTheme("dark"); onClose(); }}><Moon className="h-4 w-4 text-muted" /> Dark</Command.Item>
            <Command.Item className={itemCls} onSelect={() => { setTheme("system"); onClose(); }}><Monitor className="h-4 w-4 text-muted" /> Auto (system)</Command.Item>
          </Command.Group>
        </Command.List>
      </Command>
    </Dialog>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [palette, setPalette] = useState(false);
  const [help, setHelp] = useState(false);
  const [quick, setQuick] = useState<{ view: QuickView; cat?: string }>({ view: null });
  const [sidebarOpen, setSidebarOpen] = useSidebarPref();

  const newProject = useCallback((cat?: string) => setQuick({ view: "project", cat }), []);
  const openPalette = useCallback(() => setPalette(true), []);
  const openQuick = useCallback(() => setQuick({ view: "menu" }), []);

  useEffect(() => {
    // Two-key navigation: press `g`, then a letter. The window between the keys is short enough that a
    // stray `g` while reading does nothing, and any other key cancels the sequence.
    const GO: Record<string, string> = {
      t: "/",
      p: "/projects",
      k: "/tasks",
      d: "/diary",
      o: "/portfolio",
      n: "/money",
      m: "/mints",
      l: "/watchlist",
      w: "/wallets",
      a: "/assistant",
      r: "/recap",
      s: "/settings",
      c: "/feed",
    };
    let armed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

      if (armed) {
        armed = false;
        clearTimeout(timer);
        const dest = GO[e.key.toLowerCase()];
        if (dest) {
          e.preventDefault();
          router.push(dest);
          return;
        }
      }

      if (e.key === "g" || e.key === "G") {
        armed = true;
        timer = setTimeout(() => { armed = false; }, 1400);
        return;
      }
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        const cat = new URLSearchParams(window.location.search).get("cat") ?? undefined;
        newProject(cat && cat !== "all" ? cat : undefined);
      }
      if (e.key === "/") {
        e.preventDefault();
        setPalette(true);
      }
      if (e.key === "?") {
        e.preventDefault();
        setHelp((h) => !h);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(timer);
    };
  }, [newProject, router]);

  return (
    <Ctx.Provider value={{ newProject, openPalette, openQuick }}>
      <ShortcutHelp open={help} onClose={() => setHelp(false)} />
      <AnimatedSidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen} className="bg-bg" style={{ "--sidebar-width": "15.5rem", "--sidebar-width-icon": "3.75rem" } as never}>
        <AnimatedSidebar ariaLabel="farmOS" collapsible="icon" panelClassName="bg-sidebar border-line" className="[&_[data-slot=sidebar-menu-button]]:rounded-lg">
          <Suspense fallback={null}>
            <SidebarBody />
          </Suspense>
        </AnimatedSidebar>
        <AnimatedSidebarInset className="bg-bg">
          {/* Mobile: no dock. The menu button opens the sidebar as a drawer, so every page stays reachable. */}
          <header className="sticky top-0 z-40 border-b border-line bg-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur-md md:hidden">
            <div className="grid h-12 grid-cols-[auto_1fr_auto] items-center gap-2 pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))]">
              <AnimatedSidebarTrigger className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-2 hover:bg-hover" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </AnimatedSidebarTrigger>
              <Link href="/" className="justify-self-center"><Logo /></Link>
              <div className="flex items-center">
                <button onClick={openPalette} className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-2 hover:bg-hover" aria-label="Search">
                  <Search className="h-[18px] w-[18px]" />
                </button>
                <button onClick={openQuick} className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-2 hover:bg-hover" aria-label="Quick add">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-ink"><Plus className="h-4 w-4" strokeWidth={2.2} /></span>
                </button>
              </div>
            </div>
          </header>
          <div className="min-w-0 max-w-full flex-1 overflow-x-clip">{children}</div>
        </AnimatedSidebarInset>
      </AnimatedSidebarProvider>
      <Fab
        className="bottom-6 right-6 hidden md:flex"
        label="Create"
        actions={[
          { id: "project", label: "New project", icon: <Layers />, shortcut: "N", onSelect: () => newProject() },
          { id: "task", label: "New daily task", icon: <ListChecks />, onSelect: () => setQuick({ view: "task" }) },
          { id: "diary", label: "New diary entry", icon: <NotebookPen />, onSelect: () => (window.location.href = "/diary?new=1") },
        ]}
      />
      <Palette open={palette} onClose={() => setPalette(false)} />
      <QuickAdd view={quick.view} category={quick.cat} setView={(v) => setQuick((q) => ({ ...q, view: v }))} />
    </Ctx.Provider>
  );
}

export function PageHeader({ title, subtitle, right }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-serif text-[30px] font-normal leading-[1.1] tracking-[-0.015em] text-ink sm:text-[34px]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[13.5px] text-muted">{subtitle}</p>}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}

export function Page({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
      className={cn("mx-auto w-full min-w-0 px-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-5 sm:px-8 md:pb-24 md:pt-10", wide ? "max-w-[1280px]" : "max-w-[980px]")}
    >
      {children}
    </motion.div>
  );
}
