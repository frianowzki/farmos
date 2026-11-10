"use client";
import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import type { Attachment, DiaryEntry, Position, Project, Task, Wallet } from "@/db/schema";

export type { DiaryEntry, Position, Project, Task, Wallet };

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function api<T = unknown>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: init?.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (res.status === 401 && typeof window !== "undefined" && !url.startsWith("/api/google")) {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((j as { error?: string }).error ?? `Request failed (${res.status})`, res.status);
  return j as T;
}

export const keys = {
  projects: ["projects"] as QueryKey,
  project: (id: string) => ["project", id] as QueryKey,
  tasks: ["tasks"] as QueryKey,
  diary: ["diary"] as QueryKey,
  wallets: ["wallets"] as QueryKey,
  google: ["google-status"] as QueryKey,
  ai: ["ai-config"] as QueryKey,
  threads: ["threads"] as QueryKey,
  profile: ["profile"] as QueryKey,
};

export type ProfileInfo = { id: string; name: string; tz: string };

/** The signed-in profile (Iya's "default" or profile 2) and its display name. */
export function useProfile() {
  return useQuery({ queryKey: keys.profile, queryFn: () => api<ProfileInfo>("/api/profile"), staleTime: 5 * 60_000 });
}

export function useProjects() {
  return useQuery({
    queryKey: keys.projects,
    queryFn: () => api<{ projects: Project[]; positions: Position[] }>("/api/projects"),
    staleTime: 15_000,
  });
}

export type ProjectDetail = {
  project: Project;
  positions: Position[];
  tasks: Task[];
  attachments: Attachment[];
  diary: DiaryEntry[];
  calendar: { kind: string; eventId: string; day: string }[];
};

export function useProject(id: string) {
  return useQuery({ queryKey: keys.project(id), queryFn: () => api<ProjectDetail>(`/api/projects/${id}`), enabled: Boolean(id) });
}

export function useTasks() {
  return useQuery({
    queryKey: keys.tasks,
    queryFn: () => api<{ tasks: Task[]; completions: { taskId: string; day: string }[] }>("/api/tasks"),
    staleTime: 10_000,
  });
}

export function useDiary() {
  return useQuery({ queryKey: keys.diary, queryFn: () => api<{ entries: DiaryEntry[] }>("/api/diary") });
}

export function useWallets() {
  return useQuery({ queryKey: keys.wallets, queryFn: () => api<{ wallets: Wallet[] }>("/api/wallets") });
}

export type GoogleStatus = { configured: boolean; connected: boolean; email: string | null; scope: string | null };
export function useGoogleStatus() {
  return useQuery({ queryKey: keys.google, queryFn: () => api<GoogleStatus>("/api/google/status"), staleTime: 60_000 });
}

export type AiPublic = { baseUrl: string; model: string; hasKey: boolean; keyFromSettings: boolean; keyMask: string | null; source: string; configured: boolean; tools: boolean; etherscan: boolean };
export function useAiConfig() {
  return useQuery({ queryKey: keys.ai, queryFn: () => api<AiPublic>("/api/settings/ai") });
}

/** Patch a project with optimistic update across list + detail caches. */
export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Project> }) => api<{ project: Project }>(`/api/projects/${id}`, { method: "PATCH", body: patch }),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: keys.projects });
      const prevList = qc.getQueryData<{ projects: Project[]; positions: Position[] }>(keys.projects);
      const prevOne = qc.getQueryData<ProjectDetail>(keys.project(id));
      if (prevList) qc.setQueryData(keys.projects, { ...prevList, projects: prevList.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
      if (prevOne) qc.setQueryData(keys.project(id), { ...prevOne, project: { ...prevOne.project, ...patch } });
      return { prevList, prevOne };
    },
    onError: (_e, { id }, ctx) => {
      if (ctx?.prevList) qc.setQueryData(keys.projects, ctx.prevList);
      if (ctx?.prevOne) qc.setQueryData(keys.project(id), ctx.prevOne);
    },
    onSettled: (_d, _e, { id }) => {
      qc.invalidateQueries({ queryKey: keys.projects });
      qc.invalidateQueries({ queryKey: keys.project(id) });
    },
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Project>) => api<{ project: Project }>("/api/projects", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.projects }),
  });
}

export function useInvalidate() {
  const qc = useQueryClient();
  return (...k: QueryKey[]) => Promise.all(k.map((key) => qc.invalidateQueries({ queryKey: key })));
}
