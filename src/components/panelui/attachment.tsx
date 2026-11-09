"use client";
/**
 * Attachment — PanelUI's Attachment (native-only upstream), rebuilt for the web: file rows with upload
 * states (uploading with progress, done, failed), plus a drop zone. Files go to a private Vercel Blob
 * store through /api/attachments and are streamed back through the gated app.
 */
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, FileText, ImageIcon, Paperclip, Trash2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/cn";

export type AttachmentRow = { id: string; name: string; size: number; contentType: string | null; createdAt?: string | Date };
type Pending = { key: string; name: string; size: number; progress: number; error?: string };

const fmt = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

function upload(file: File, target: { projectId?: string; diaryId?: string }, onProgress: (p: number) => void) {
  return new Promise<AttachmentRow>((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", file);
    if (target.projectId) fd.append("projectId", target.projectId);
    if (target.diaryId) fd.append("diaryId", target.diaryId);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/attachments");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      let j: { attachment?: AttachmentRow; error?: string } = {};
      try { j = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status < 300 && j.attachment) resolve(j.attachment);
      else reject(new Error(j.error ?? `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(fd);
  });
}

export function Attachments({ items, target, onChange, onRemove, disabled }: { items: AttachmentRow[]; target: { projectId?: string; diaryId?: string }; onChange: () => void; onRemove: (id: string) => Promise<void> | void; disabled?: string | null }) {
  const [pending, setPending] = useState<Pending[]>([]);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const add = (files: FileList | File[]) => {
    for (const f of Array.from(files)) {
      const key = `${f.name}-${f.size}-${Math.random()}`;
      setPending((p) => [...p, { key, name: f.name, size: f.size, progress: 0 }]);
      upload(f, target, (progress) => setPending((p) => p.map((x) => (x.key === key ? { ...x, progress } : x))))
        .then(() => { setPending((p) => p.filter((x) => x.key !== key)); onChange(); })
        .catch((e: Error) => setPending((p) => p.map((x) => (x.key === key ? { ...x, error: e.message } : x))));
    }
  };

  return (
    <div className="space-y-2">
      <ul className="space-y-1">
        <AnimatePresence initial={false}>
          {items.map((a) => (
            <motion.li key={a.id} layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="group flex items-center gap-2.5 rounded-lg border border-line bg-panel px-2.5 py-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-hover text-muted">
                {a.contentType?.startsWith("image/") ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
              </span>
              <a href={`/api/attachments/${a.id}/file`} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] text-ink hover:underline">{a.name}</div>
                <div className="num text-[11.5px] text-muted">{fmt(a.size)}</div>
              </a>
              <button type="button" aria-label={`Remove ${a.name}`} onClick={() => onRemove(a.id)} className="rounded-md p-1.5 text-faint opacity-0 hover:bg-hover hover:text-neg focus-visible:opacity-100 group-hover:opacity-100">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </motion.li>
          ))}
          {pending.map((p) => (
            <motion.li key={p.key} layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={cn("relative flex items-center gap-2.5 overflow-hidden rounded-lg border bg-panel px-2.5 py-2", p.error ? "border-[var(--t-red-fg)]/40" : "border-line")}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-hover text-muted">{p.error ? <AlertCircle className="h-4 w-4 text-neg" /> : <Paperclip className="h-4 w-4" />}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] text-ink">{p.name}</div>
                <div className={cn("text-[11.5px]", p.error ? "text-neg" : "num text-muted")}>{p.error ?? `${Math.round(p.progress * 100)}% · ${fmt(p.size)}`}</div>
              </div>
              {p.error && <button type="button" className="text-[12px] text-muted hover:text-ink" onClick={() => setPending((x) => x.filter((y) => y.key !== p.key))}>Dismiss</button>}
              {!p.error && <motion.span className="absolute bottom-0 left-0 h-[2px] origin-left bg-accent" style={{ width: "100%" }} initial={{ scaleX: 0 }} animate={{ scaleX: p.progress }} />}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {disabled ? (
        <div className="rounded-lg border border-dashed border-line px-3 py-3 text-[12.5px] text-muted">{disabled}</div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) add(e.dataTransfer.files); }}
          className={cn("flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-3 text-[12.5px] transition-colors", drag ? "border-accent bg-accent-soft text-ink" : "border-line text-muted hover:border-line-strong hover:text-ink")}
        >
          <UploadCloud className="h-4 w-4" /> Drop files or click to attach <span className="text-faint">· up to 4 MB</span>
        </button>
      )}
      <input ref={input} type="file" multiple hidden onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = ""; }} />
    </div>
  );
}
