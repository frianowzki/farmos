"use client";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, NotebookPen, Plus, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Editor } from "@/components/editor";
import { Page, PageHeader } from "@/components/shell";
import { Button, Empty, Pill, Skeleton, TagInput } from "@/components/ui";
import { cn } from "@/lib/cn";
import { today as todayFn } from "@/lib/dates";
import { api, keys, useDiary, useProjects, type DiaryEntry } from "@/lib/client/api";

export function DiaryView() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const { data, isLoading } = useDiary();
  const { data: pd } = useProjects();
  const [filter, setFilter] = useState<string>("");
  const creating = useRef(false);
  const selected = sp.get("entry");

  const open = (id: string | null) => router.replace(id ? `${pathname}?entry=${id}` : pathname, { scroll: false });

  useEffect(() => {
    if (sp.get("new") !== "1" || creating.current) return;
    creating.current = true;
    const project = sp.get("project");
    api<{ entry: DiaryEntry }>("/api/diary", { method: "POST", body: { day: todayFn(), title: "", content: "", projectIds: project ? [project] : [] } })
      .then(({ entry }) => {
        qc.invalidateQueries({ queryKey: keys.diary });
        if (project) qc.invalidateQueries({ queryKey: keys.project(project) });
        open(entry.id);
      })
      .catch((e) => toast.error((e as Error).message))
      .finally(() => (creating.current = false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  const entries = useMemo(() => (data?.entries ?? []).filter((e) => !filter || e.projectIds.includes(filter)), [data, filter]);
  const current = data?.entries.find((e) => e.id === selected);
  const pname = (id: string) => pd?.projects.find((p) => p.id === id)?.name ?? "…";

  const grouped = useMemo(() => {
    const m = new Map<string, DiaryEntry[]>();
    for (const e of entries) {
      const k = e.day.slice(0, 7);
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return [...m.entries()];
  }, [entries]);

  if (current) return <EntryEditor key={current.id} entry={current} onBack={() => open(null)} />;

  return (
    <Page>
      <PageHeader
        eyebrow="Workspace"
        title="Diary"
        subtitle="Dated notes. Tag them to projects and they show up on the project page too."
        right={<Button variant="primary" onClick={() => router.replace(`${pathname}?new=1`)}><Plus className="h-3.5 w-3.5" /> New entry</Button>}
      />
      {(pd?.projects.length ?? 0) > 0 && (
        <div className="mb-5 flex flex-wrap gap-1.5">
          <button onClick={() => setFilter("")} className={cn("h-7 rounded-md px-2.5 text-[12.5px]", !filter ? "bg-active text-ink" : "text-muted hover:bg-hover")}>All</button>
          {pd!.projects.filter((p) => data?.entries.some((e) => e.projectIds.includes(p.id))).map((p) => (
            <button key={p.id} onClick={() => setFilter(p.id)} className={cn("h-7 rounded-md px-2.5 text-[12.5px]", filter === p.id ? "bg-active text-ink" : "text-muted hover:bg-hover")}>{p.name}</button>
          ))}
        </div>
      )}
      {isLoading ? (
        <Skeleton className="h-48" />
      ) : entries.length === 0 ? (
        <Empty icon={<NotebookPen className="h-6 w-6" />} title="Nothing written yet" body="A two-line note a day compounds: what you farmed, what changed, what to check tomorrow." action={<Button variant="primary" onClick={() => router.replace(`${pathname}?new=1`)}><Plus className="h-3.5 w-3.5" /> Write today&apos;s entry</Button>} />
      ) : (
        <div className="space-y-8">
          {grouped.map(([month, list]) => (
            <section key={month}>
              <div className="mb-2 font-serif text-[15px] italic text-muted">{new Date(month + "-01T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" })}</div>
              <div className="divide-y divide-line rounded-lg border border-line bg-panel">
                {list.map((e) => {
                  const d = new Date(e.day + "T00:00:00");
                  const text = e.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
                  return (
                    <button key={e.id} onClick={() => open(e.id)} className="flex w-full items-start gap-4 px-4 py-3 text-left transition-colors hover:bg-hover">
                      <div className="w-10 shrink-0 text-center">
                        <div className="num text-[20px] leading-none">{d.getDate()}</div>
                        <div className="mt-0.5 text-[10.5px] uppercase tracking-wide text-faint">{d.toLocaleDateString("en-US", { weekday: "short" })}</div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-medium">{e.title || <span className="text-muted">Untitled</span>}</div>
                        <div className="line-clamp-2 text-[13px] text-muted">{text || "Empty entry"}</div>
                        {e.projectIds.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{e.projectIds.map((id) => <Pill key={id} tone="stone">{pname(id)}</Pill>)}</div>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </Page>
  );
}

function EntryEditor({ entry, onBack }: { entry: DiaryEntry; onBack: () => void }) {
  const qc = useQueryClient();
  const { data: pd } = useProjects();
  const [title, setTitle] = useState(entry.title);
  const [day, setDay] = useState(entry.day);
  const [projectIds, setProjectIds] = useState(entry.projectIds);
  const save = async (patch: Partial<DiaryEntry>) => {
    try {
      await api(`/api/diary/${entry.id}`, { method: "PATCH", body: patch });
      qc.invalidateQueries({ queryKey: keys.diary });
      for (const id of new Set([...entry.projectIds, ...(patch.projectIds ?? [])])) qc.invalidateQueries({ queryKey: keys.project(id) });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const projects = pd?.projects ?? [];
  const nameToId = (n: string) => projects.find((p) => p.name === n)?.id;
  return (
    <Page>
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-3.5 w-3.5" /> Diary</Button>
        <Button
          variant="danger"
          size="sm"
          onClick={async () => {
            if (!confirm("Delete this entry?")) return;
            await api(`/api/diary/${entry.id}`, { method: "DELETE" });
            qc.invalidateQueries({ queryKey: keys.diary });
            onBack();
          }}
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
      </div>
      <input type="date" value={day} onChange={(e) => { setDay(e.target.value); if (e.target.value) save({ day: e.target.value }); }} className="num mb-1 bg-transparent text-[12.5px] text-muted outline-none" />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => title !== entry.title && save({ title })}
        placeholder={new Date(day + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        className="w-full bg-transparent font-serif text-[34px] leading-tight tracking-[-0.015em] outline-none placeholder:text-faint"
      />
      <div className="mb-5 mt-2 flex items-center gap-2">
        <span className="text-[12.5px] text-muted">Projects</span>
        <div className="flex-1">
          <TagInput
            value={projectIds.map((id) => projects.find((p) => p.id === id)?.name ?? id)}
            onChange={(names) => {
              const ids = names.map((n) => nameToId(n)).filter(Boolean) as string[];
              setProjectIds(ids);
              save({ projectIds: ids });
            }}
            suggestions={projects.map((p) => p.name)}
            placeholder="Tag projects"
            tone="stone"
          />
        </div>
      </div>
      <Editor value={entry.content} onSave={(html) => save({ content: html })} placeholder="What happened today? What did you farm, learn, or decide?" minHeight={360} />
    </Page>
  );
}
