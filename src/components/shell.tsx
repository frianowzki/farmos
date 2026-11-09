"use client";
import { Command } from "cmdk";
import {
  ArrowRight, Flame, FlaskConical, Gift, Image as ImageIcon, Layers, ListChecks, Lock, Mail, Menu, Monitor, Moon, NotebookPen, Plus, Search,
  Settings2, Sun, SunMedium, Telescope, Wallet, X, ChartNoAxesColumn, Pin,
} from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useMounted } from "@/lib/client/use-mounted";
import { toast } from "sonner";
import { Button, Dialog, Field, Input, Kbd, TagInput } from "@/components/ui";
import { cn } from "@/lib/cn";
import { CHAIN_SUGGESTIONS, CATEGORIES } from "@/lib/constants";
import { api, useCreateProject, useProjects } from "@/lib/client/api";
import { CATEGORY_OPTS, monoTone } from "@/lib/options";

type ShellCtx = { newProject: (category?: string) => void; openPalette: () => void };
const Ctx = createContext<ShellCtx>({ newProject: () => {}, openPalette: () => {} });
export const useShell = () => useContext(Ctx);

const CAT_ICON: Record<string, typeof Gift> = { airdrop: Gift, testnet: FlaskConical, nft: ImageIcon, degen: Flame };

const NAV = [
  { href: "/", label: "Today", icon: SunMedium },
  { href: "/tasks", label: "Daily tasks", icon: ListChecks },
  { href: "/diary", label: "Diary", icon: NotebookPen },
  { href: "/portfolio", label: "Portfolio", icon: ChartNoAxesColumn },
  { href: "/mail", label: "Mail", icon: Mail },
  { href: "/assistant", label: "Research desk", icon: Telescope },
  { href: "/wallets", label: "Wallets", icon: Wallet },
];

export function Monogram({ name, size = 20, className }: { name: string; size?: number; className?: string }) {
  const t = monoTone(name || "?");
  return (
    <span
      style={{ width: size, height: size, fontSize: size * 0.55 }}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-[5px] font-serif font-medium leading-none", `tone-${t}`, className)}
    >
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-baseline gap-[1px] select-none", className)}>
      <span className="font-serif text-[19px] font-medium italic tracking-[-0.01em] text-ink">frio</span>
      <span className="num text-[11px] font-semibold tracking-[0.08em] text-accent">OS</span>
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
          onClick={() => setTheme(o.id)}
          className={cn("flex h-6 flex-1 items-center justify-center gap-1 rounded-[5px] px-2 text-[11.5px] text-muted transition-colors", mounted && theme === o.id ? "bg-active text-ink" : "hover:text-ink")}
        >
          <o.icon className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

function SidebarInner({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const { data } = useProjects();
  const { newProject, openPalette } = useShell();
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0 };
    for (const p of data?.projects ?? []) {
      if (p.status === "done" || p.status === "dropped") continue;
      c.all++;
      c[p.category] = (c[p.category] ?? 0) + 1;
    }
    return c;
  }, [data]);
  const pinned = (data?.projects ?? []).filter((p) => p.pinned).slice(0, 8);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const cat = pathname === "/projects" ? sp.get("cat") ?? "all" : null;

  const item = "group flex h-[30px] items-center gap-2.5 rounded-md px-2 text-[13.5px] text-ink-2 transition-colors hover:bg-hover hover:text-ink";
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 pb-2 pt-3.5">
        <Link href="/" onClick={onNavigate} className="rounded px-1">
          <Logo />
        </Link>
        <button onClick={() => newProject()} title="New project (N)" className="rounded-md p-1.5 text-muted hover:bg-hover hover:text-ink" aria-label="New project">
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="px-2 pb-2">
        <button onClick={openPalette} className="flex h-8 w-full items-center gap-2 rounded-md border border-line bg-panel px-2 text-[13px] text-muted transition-colors hover:border-line-strong">
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">Search or jump to…</span>
          <Kbd>⌘K</Kbd>
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 pb-3">
        <div className="space-y-px">
          {NAV.slice(0, 1).map((n) => (
            <Link key={n.href} href={n.href} onClick={onNavigate} className={cn(item, isActive(n.href) && "bg-active text-ink")}>
              <n.icon className="h-4 w-4 text-muted group-hover:text-ink-2" />
              {n.label}
            </Link>
          ))}
        </div>
        <div className="mb-1 mt-4 px-2 text-[11.5px] font-medium text-faint">Projects</div>
        <div className="space-y-px">
          <Link href="/projects" onClick={onNavigate} className={cn(item, cat === "all" && "bg-active text-ink")}>
            <Layers className="h-4 w-4 text-muted" />
            <span className="flex-1">All projects</span>
            <span className="num text-[11.5px] text-faint">{counts.all || ""}</span>
          </Link>
          {CATEGORIES.map((c) => {
            const Icon = CAT_ICON[c.id];
            return (
              <Link key={c.id} href={`/projects?cat=${c.id}`} onClick={onNavigate} className={cn(item, cat === c.id && "bg-active text-ink")}>
                <Icon className="h-4 w-4 text-muted" />
                <span className="flex-1">{c.label}</span>
                <span className="num text-[11.5px] text-faint">{counts[c.id] || ""}</span>
              </Link>
            );
          })}
        </div>
        <div className="mb-1 mt-4 px-2 text-[11.5px] font-medium text-faint">Workspace</div>
        <div className="space-y-px">
          {NAV.slice(1).map((n) => (
            <Link key={n.href} href={n.href} onClick={onNavigate} className={cn(item, isActive(n.href) && "bg-active text-ink")}>
              <n.icon className="h-4 w-4 text-muted" />
              {n.label}
            </Link>
          ))}
        </div>
        {pinned.length > 0 && (
          <>
            <div className="mb-1 mt-4 flex items-center gap-1 px-2 text-[11.5px] font-medium text-faint">
              <Pin className="h-3 w-3" /> Pinned
            </div>
            <div className="space-y-px">
              {pinned.map((p) => (
                <Link key={p.id} href={`/projects/${p.id}`} onClick={onNavigate} className={cn(item, pathname === `/projects/${p.id}` && "bg-active text-ink")}>
                  <Monogram name={p.name} size={18} />
                  <span className="truncate">{p.name}</span>
                </Link>
              ))}
            </div>
          </>
        )}
      </nav>
      <div className="space-y-2 border-t border-line p-2">
        <div className="flex items-center gap-1">
          <Link href="/settings" onClick={onNavigate} className={cn(item, "flex-1", isActive("/settings") && "bg-active text-ink")}>
            <Settings2 className="h-4 w-4 text-muted" /> Settings
          </Link>
          <button
            title="Lock frioOS"
            aria-label="Lock"
            onClick={async () => {
              await api("/api/unlock", { method: "DELETE" });
              // full reload so every cached query is dropped
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination
              window.location.href = "/login";
            }}
            className="rounded-md p-2 text-muted hover:bg-hover hover:text-ink"
          >
            <Lock className="h-3.5 w-3.5" />
          </button>
        </div>
        <ThemeSwitch />
      </div>
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Suspense fallback={null}>
      <SidebarInner onNavigate={onNavigate} />
    </Suspense>
  );
}

function NewProjectDialog({ open, onClose, initialCategory }: { open: boolean; onClose: () => void; initialCategory?: string }) {
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
      onClose();
      router.push(`/projects/${project.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} title="New project">
      <form
        className="space-y-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Input autoFocus placeholder="Project name, e.g. Monad testnet" value={name} onChange={(e) => setName(e.target.value)} className="h-10 text-[15px]" />
        <div className="grid grid-cols-4 gap-1 rounded-lg bg-hover p-1">
          {CATEGORY_OPTS.map((c) => {
            const Icon = CAT_ICON[c.id];
            return (
              <button
                type="button"
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={cn("flex h-8 items-center justify-center gap-1.5 rounded-md text-[13px] transition-colors", category === c.id ? "bg-panel text-ink shadow-sm" : "text-muted hover:text-ink")}
              >
                <Icon className="h-3.5 w-3.5" /> {c.label}
              </button>
            );
          })}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Website">
            <Input placeholder="https://" value={site} onChange={(e) => setSite(e.target.value)} />
          </Field>
          <Field label="X handle">
            <Input placeholder="@project" value={x} onChange={(e) => setX(e.target.value)} />
          </Field>
        </div>
        <Field label="Chains">
          <div className="rounded-md border border-line px-1">
            <TagInput value={chains} onChange={setChains} suggestions={CHAIN_SUGGESTIONS} placeholder="Add chains" />
          </div>
        </Field>
        <div className="flex items-center justify-between pt-1">
          <span className="text-[12px] text-faint">Everything else lives on the project page.</span>
          <Button variant="primary" type="submit" disabled={!name.trim() || create.isPending}>
            Create project <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function Palette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const { data } = useProjects();
  const { newProject } = useShell();
  const go = (href: string) => {
    onClose();
    router.push(href);
  };
  const itemCls = "flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-[13.5px] text-ink-2 data-[selected=true]:bg-hover data-[selected=true]:text-ink";
  const group = "[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:text-[11.5px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-faint";
  return (
    <Dialog open={open} onClose={onClose} width={600}>
      <Command label="Command palette" className="-m-4">
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
                  <Monogram name={p.name} size={18} /> {p.name}
                  <span className="ml-auto text-[12px] capitalize text-faint">{p.category}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}
          <Command.Group heading="Go to" className={group}>
            {[...NAV, { href: "/projects", label: "All projects", icon: Layers }, { href: "/settings", label: "Settings", icon: Settings2 }].map((n) => (
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
  const [palette, setPalette] = useState(false);
  const [np, setNp] = useState<{ open: boolean; cat?: string; n: number }>({ open: false, n: 0 });
  const [drawer, setDrawer] = useState(false);

  const newProject = useCallback((cat?: string) => setNp((s) => ({ open: true, cat, n: s.n + 1 })), []);
  const openPalette = useCallback(() => setPalette(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        const cat = new URLSearchParams(window.location.search).get("cat") ?? undefined;
        newProject(cat && cat !== "all" ? cat : undefined);
      }
      if (e.key === "/") {
        e.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newProject]);

  return (
    <Ctx.Provider value={{ newProject, openPalette }}>
      <div className="flex min-h-dvh">
        <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 border-r border-line bg-sidebar md:block">
          <Sidebar />
        </aside>
        {drawer && (
          <div className="anim-fade fixed inset-0 z-[60] bg-black/30 md:hidden" onClick={() => setDrawer(false)}>
            <aside className="anim-rise h-full w-[280px] border-r border-line bg-sidebar" onClick={(e) => e.stopPropagation()}>
              <button className="absolute left-[244px] top-3 rounded-md p-1.5 text-muted" onClick={() => setDrawer(false)} aria-label="Close menu">
                <X className="h-4 w-4" />
              </button>
              <Sidebar onNavigate={() => setDrawer(false)} />
            </aside>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 flex h-12 items-center justify-between border-b border-line bg-bg/90 px-3 backdrop-blur md:hidden">
            <button onClick={() => setDrawer(true)} className="rounded-md p-1.5 text-ink-2 hover:bg-hover" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/"><Logo /></Link>
            <div className="flex">
              <button onClick={openPalette} className="rounded-md p-1.5 text-ink-2 hover:bg-hover" aria-label="Search">
                <Search className="h-[18px] w-[18px]" />
              </button>
              <button onClick={() => newProject()} className="rounded-md p-1.5 text-ink-2 hover:bg-hover" aria-label="New project">
                <Plus className="h-[18px] w-[18px]" />
              </button>
            </div>
          </header>
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
      <Palette open={palette} onClose={() => setPalette(false)} />
      <NewProjectDialog key={np.n} open={np.open} initialCategory={np.cat} onClose={() => setNp((s) => ({ ...s, open: false }))} />
    </Ctx.Provider>
  );
}

export function PageHeader({ title, subtitle, right, eyebrow }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-[12px] font-medium text-muted">{eyebrow}</div>}
        <h1 className="font-serif text-[30px] font-normal leading-[1.1] tracking-[-0.015em] text-ink sm:text-[34px]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[13.5px] text-muted">{subtitle}</p>}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}

export function Page({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return <div className={cn("anim-fade mx-auto w-full px-4 pb-24 pt-6 sm:px-8 md:pt-10", wide ? "max-w-[1280px]" : "max-w-[980px]")}>{children}</div>;
}
