"use client";
import { useQuery } from "@tanstack/react-query";
import { Mail as MailIcon, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Button, Empty, Pill, Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { MAIL_SIGNALS } from "@/lib/mailmatch";
import { api, useGoogleStatus, useProjects } from "@/lib/client/api";

export type MailRow = { id: string; threadId: string; from: string; subject: string; snippet: string; date: string; unread: boolean; signals: string[]; projectIds: string[] };

const SIGNAL_TONE: Record<string, string> = { whitelist: "green", kyc: "amber", claim: "violet", mint: "blue", testnet: "blue", security: "red" };

export function GoogleSetupState({ compact }: { compact?: boolean }) {
  const { data } = useGoogleStatus();
  if (!data) return <Skeleton className="h-24" />;
  if (!data.configured)
    return (
      <Empty
        icon={<MailIcon className="h-6 w-6" />}
        title="Connect Google to see project mail"
        body={compact ? "Add Google OAuth credentials on the server first." : <>Gmail and Calendar need a Google OAuth client. Add <code className="num text-[12px]">GOOGLE_CLIENT_ID</code> and <code className="num text-[12px]">GOOGLE_CLIENT_SECRET</code> in Vercel, redeploy, then connect here. Steps are in <code className="num text-[12px]">SETUP.md</code>.</>}
        action={<Link href="/settings#google"><Button>Open settings</Button></Link>}
      />
    );
  return (
    <Empty
      icon={<MailIcon className="h-6 w-6" />}
      title="Google is ready to connect"
      body="Read-only Gmail access lets farmOS match whitelist, KYC and claim emails to your projects."
      action={<Link href="/settings#google"><Button variant="primary">Connect Google</Button></Link>}
    />
  );
}

export function MailList({ projectId, days = 21 }: { projectId?: string; days?: number }) {
  const g = useGoogleStatus();
  const { data: pdata } = useProjects();
  const q = useQuery({
    queryKey: ["mail", projectId ?? "all", days],
    queryFn: () => api<{ items: MailRow[] }>(`/api/google/mail?days=${days}${projectId ? `&projectId=${projectId}` : ""}`),
    enabled: Boolean(g.data?.connected),
    staleTime: 60_000,
  });
  if (!g.data?.connected) return <GoogleSetupState compact={Boolean(projectId)} />;
  if (q.isLoading) return <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>;
  if (q.error) return <div className="rounded-lg border border-line p-4 text-[13px] text-neg">{(q.error as Error).message}</div>;
  const items = q.data?.items ?? [];
  const pname = (id: string) => pdata?.projects.find((p) => p.id === id)?.name;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[12px] text-muted">
        <span>{items.length} messages · {g.data.email}</span>
        <Button size="sm" variant="ghost" onClick={() => q.refetch()} disabled={q.isFetching}>
          <RefreshCw className={cn("h-3.5 w-3.5", q.isFetching && "animate-spin")} /> Refresh
        </Button>
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line py-8 text-center text-[13px] text-muted">No matching mail{projectId ? ". Add sender domains under Mail matchers to improve matching." : "."}</div>
      ) : (
        <div className="divide-y divide-line rounded-lg border border-line bg-panel">
          {items.map((m) => (
            <a key={m.id} href={`https://mail.google.com/mail/u/0/#all/${m.threadId}`} target="_blank" rel="noreferrer" className="block px-3 py-2.5 transition-colors hover:bg-hover">
              <div className="flex items-center gap-2">
                {m.unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                <span className={cn("truncate text-[13px]", m.unread ? "font-semibold" : "text-ink-2")}>{m.from.replace(/<.*>/, "").replace(/"/g, "").trim() || m.from}</span>
                <span className="num ml-auto shrink-0 text-[11.5px] text-faint">{new Date(m.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              </div>
              <div className={cn("mt-0.5 truncate text-[13.5px]", m.unread && "font-medium")}>{m.subject}</div>
              <div className="truncate text-[12.5px] text-muted">{m.snippet}</div>
              {(m.signals.length > 0 || (!projectId && m.projectIds.length > 0)) && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {m.signals.map((s) => <Pill key={s} tone={SIGNAL_TONE[s]}>{MAIL_SIGNALS.find((x) => x.id === s)?.label}</Pill>)}
                  {!projectId && m.projectIds.map((id) => pname(id) && <Pill key={id} tone="stone">{pname(id)}</Pill>)}
                </div>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
