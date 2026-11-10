"use client";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button, Dialog } from "@/components/ui";
import { api, keys } from "@/lib/client/api";
import { toast } from "@/lib/client/toast";

/** Confirm sheet for deleting a project (positions, tasks and links go with it). Server delete is profile-scoped. */
export function DeleteProjectDialog({ project, open, onClose, onDeleted }: { project: { id: string; name: string }; open: boolean; onClose: () => void; onDeleted?: () => void }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await api(`/api/projects/${project.id}`, { method: "DELETE" });
      qc.removeQueries({ queryKey: keys.project(project.id) });
      qc.invalidateQueries({ queryKey: keys.projects });
      qc.invalidateQueries({ queryKey: keys.tasks });
      qc.invalidateQueries({ queryKey: keys.diary });
      toast.success(`Deleted “${project.name}”`);
      onClose();
      onDeleted?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onClose={() => !busy && onClose()} title="Delete project?" width={420}>
      <p className="text-[13.5px] text-ink-2">
        “<span className="font-medium text-ink">{project.name}</span>” will be deleted with its positions, tasks and files. This can&apos;t be undone.
      </p>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button className="h-10 sm:h-8" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="primary" className="h-10 bg-neg hover:not-disabled:bg-neg/90 sm:h-8" onClick={run} disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Delete project
        </Button>
      </div>
    </Dialog>
  );
}
