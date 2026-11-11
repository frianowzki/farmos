"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui";
import { api, keys } from "@/lib/client/api";
import { CATEGORY_OPTS, ELIGIBILITY_OPTS, PRIORITY_OPTS, RISK_OPTS, STATUS_OPTS, TIER_OPTS } from "@/lib/options";

type Patch = { status?: string; category?: string; priority?: string; pinned?: boolean; tier?: string; risk?: string; eligibility?: string };

/** Selection state for the projects table — ids only, so re-sorting never desyncs from the rows. */
export function useSelection() {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const toggleAll = useCallback((all: string[]) => {
    setIds((prev) => (prev.size === all.length ? new Set() : new Set(all)));
  }, []);
  const clear = useCallback(() => setIds(new Set()), []);
  return { ids, toggle, toggleAll, clear };
}

export function useBulkUpdate(onDone: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, patch }: { ids: string[]; patch: Patch }) =>
      api<{ updated: number }>("/api/projects/bulk", { method: "PATCH", body: { ids, patch } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.projects });
      onDone();
    },
  });
}

const FIELDS: { key: keyof Patch; label: string; opts: { id: string; label: string }[] }[] = [
  { key: "status", label: "Status", opts: STATUS_OPTS },
  { key: "category", label: "Category", opts: CATEGORY_OPTS },
  { key: "priority", label: "Priority", opts: PRIORITY_OPTS },
  { key: "tier", label: "Tier", opts: TIER_OPTS },
  { key: "risk", label: "Risk", opts: RISK_OPTS },
  { key: "eligibility", label: "Eligibility", opts: ELIGIBILITY_OPTS },
];

/** Sticky action bar shown while rows are selected. Applies one field at a time, which keeps the
 *  request shape honest — a bulk call never mixes unrelated edits. */
export function BulkBar({ ids, onClear }: { ids: string[]; onClear: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const bulk = useBulkUpdate(onClear);

  const apply = (patch: Patch, field: string) => {
    setBusy(field);
    bulk.mutate({ ids, patch }, { onSettled: () => setBusy(null) });
  };

  if (ids.length === 0) return null;

  return (
    <div className="sticky bottom-4 z-30 mx-auto mt-4 flex w-fit max-w-full flex-wrap items-center gap-1.5 rounded-xl border border-line bg-panel/95 px-3 py-2 shadow-lg backdrop-blur">
      <span className="num mr-1 text-[12.5px] font-medium text-ink">{ids.length} selected</span>
      {FIELDS.map((f) => (
        <select
          key={f.key as string}
          disabled={bulk.isPending}
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value;
            e.target.value = "";
            if (v) apply({ [f.key]: v } as Patch, f.key as string);
          }}
          className="h-7 rounded-md border border-line bg-panel px-1.5 text-[12px] text-ink-2 outline-none focus:ring-2 focus:ring-[var(--ring)]"
          aria-label={`Set ${f.label}`}
        >
          <option value="">{busy === f.key ? "…" : f.label}</option>
          {f.opts.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      ))}
      <Button
        size="md"
        variant="ghost"
        disabled={bulk.isPending}
        onClick={() => apply({ pinned: true }, "pinned")}
        className="h-7 text-[12px]"
      >
        Pin
      </Button>
      <button onClick={onClear} className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-ink" aria-label="Clear selection">
        <X className="h-3.5 w-3.5" />
      </button>
      {bulk.isError && <span className="text-[11.5px] text-neg">{(bulk.error as Error).message}</span>}
    </div>
  );
}
