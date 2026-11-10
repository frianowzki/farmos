import "server-only";
import { del, list, put } from "@vercel/blob";
import { eq, getTableColumns, type InferInsertModel } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { PgColumn } from "drizzle-orm/pg-core";
import type { PgTable } from "drizzle-orm/pg-core";
import { db, schema } from "@/db";
import { dayIn } from "./tz";
import { getProfileTz } from "./settings";
export { toCsv } from "@/lib/csv";

/**
 * Tables included in export/backup/restore, in insert order (parents first).
 * Secrets are excluded on purpose: Google/OAuth tokens (connected_accounts, google_tokens)
 * and the encrypted AI key inside settings are never exported.
 */
export const TABLES = {
  projects: schema.projects,
  positions: schema.positions,
  tasks: schema.tasks,
  completions: schema.taskCompletions,
  diary: schema.diaryEntries,
  wallets: schema.wallets,
  threads: schema.chatThreads,
  mints: schema.mintWatch,
  feed: schema.feedItems,
  attachments: schema.attachments,
  calendarLinks: schema.calendarLinks,
  settings: schema.settings,
} as const satisfies Record<string, PgTable>;

export type TableName = keyof typeof TABLES;
export const TABLE_NAMES = Object.keys(TABLES) as TableName[];
const SECRET_SETTING_KEYS = new Set(["notify", "wallet_track"]); // Telegram chat id + link token; derived cache

function scrubSetting(row: { key: string; value: unknown }) {
  if (SECRET_SETTING_KEYS.has(row.key)) return null;
  if (row.key === "ai" && row.value && typeof row.value === "object") {
    const v = { ...(row.value as Record<string, unknown>) };
    delete v.apiKeyEnc;
    return { ...row, value: v };
  }
  return row;
}

export type Backup = { app: "farmOS"; version: 1; exportedAt: string } & Record<TableName, Record<string, unknown>[]>;

const pidCol = (n: TableName) => (TABLES[n] as unknown as { profileId: PgColumn }).profileId;

/** Everything that belongs to one profile (never another profile's rows). */
export async function collectBackup(pid: string): Promise<Backup> {
  const d = db();
  const entries = await Promise.all(TABLE_NAMES.map(async (n) => [n, (await d.select().from(TABLES[n] as PgTable).where(eq(pidCol(n), pid))) as Record<string, unknown>[]] as const));
  const out = { app: "farmOS", version: 1, exportedAt: new Date().toISOString() } as Backup;
  for (const [n, rows] of entries) {
    out[n] = n === "settings" ? (rows.map((r) => scrubSetting(r as { key: string; value: unknown })).filter(Boolean) as Record<string, unknown>[]) : rows;
  }
  return out;
}

export function columnsOf(name: TableName) {
  return Object.keys(getTableColumns(TABLES[name] as PgTable));
}

/** Coerce JSON values back into what drizzle expects (Date for timestamp columns). */
function revive(name: TableName, row: Record<string, unknown>) {
  const cols = getTableColumns(TABLES[name] as PgTable);
  const out: Record<string, unknown> = {};
  for (const [k, col] of Object.entries(cols)) {
    if (!(k in row)) continue;
    const v = row[k];
    out[k] = col.columnType === "PgTimestamp" && typeof v === "string" ? new Date(v) : v;
  }
  return out;
}

export function summarize(b: Partial<Record<TableName, unknown[]>>) {
  return Object.fromEntries(TABLE_NAMES.map((n) => [n, Array.isArray(b[n]) ? b[n]!.length : 0]));
}

export function validateBackup(x: unknown): x is Backup {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (!Array.isArray(o.projects)) return false;
  return TABLE_NAMES.every((n) => o[n] === undefined || Array.isArray(o[n]));
}

/** Blob prefix a profile's attachments may live under ("default" keeps the original paths). */
export function attachmentPrefix(pid: string) {
  return pid === "default" ? "attachments/" : `profiles/${pid}/attachments/`;
}
const ownsBlobPath = (pid: string, pathname: unknown) =>
  typeof pathname === "string" && pathname.startsWith(attachmentPrefix(pid)) && !pathname.includes("..") && (pid !== "default" || !pathname.startsWith("profiles/"));

/**
 * Replace ONE profile's data with the backup in one transaction (neon-http batch).
 * - Only rows of `pid` are deleted; other profiles are never touched.
 * - Every imported row gets a fresh id and profile_id = pid; relations are remapped to the new ids,
 *   so a crafted file can't overwrite or point at another profile's rows.
 * - Attachments are kept only when their blob path is inside this profile's prefix.
 * - Secret-bearing settings already in the DB (ai key, notify, telegram link) are kept.
 */
export async function restoreBackup(pid: string, b: Backup) {
  const d = db();
  const reverse = [...TABLE_NAMES].reverse();
  const keepSettings = new Set(["ai", "notify", "telegram_link", "wallet_track", "wallet_nfts"]);
  const stmts = [] as unknown[];
  for (const n of reverse) {
    if (n === "settings") continue;
    stmts.push(d.delete(TABLES[n] as PgTable).where(eq(pidCol(n), pid)));
  }
  const maps: Record<string, Map<string, string>> = { projects: new Map(), positions: new Map(), tasks: new Map(), diary: new Map(), wallets: new Map(), threads: new Map(), feed: new Map(), attachments: new Map() };
  const fresh = (n: string, old: unknown) => {
    const id = n === "threads" ? randomUUID().replace(/-/g, "") : randomUUID();
    if (typeof old === "string") maps[n].set(old, id);
    return id;
  };
  const ref = (n: string, old: unknown) => (typeof old === "string" ? maps[n].get(old) ?? null : null);
  const out: Partial<Record<TableName, Record<string, unknown>[]>> = {};
  for (const n of TABLE_NAMES) {
    const rows: Record<string, unknown>[] = [];
    for (const raw of b[n] ?? []) {
      const r = revive(n, raw);
      r.profileId = pid;
      if (n in maps) r.id = fresh(n, raw.id);
      if (n === "positions") { r.projectId = ref("projects", raw.projectId); if (!r.projectId) continue; }
      if (n === "tasks") r.projectId = raw.projectId ? ref("projects", raw.projectId) : null;
      if (n === "completions") { r.taskId = ref("tasks", raw.taskId); if (!r.taskId) continue; }
      if (n === "diary") r.projectIds = (Array.isArray(raw.projectIds) ? raw.projectIds : []).map((x) => ref("projects", x)).filter(Boolean);
      if (n === "mints") r.projectId = raw.projectId ? ref("projects", raw.projectId) : null;
      if (n === "calendarLinks") { r.projectId = ref("projects", raw.projectId); if (!r.projectId) continue; }
      if (n === "attachments") {
        if (!ownsBlobPath(pid, raw.pathname)) continue;
        r.projectId = raw.projectId ? ref("projects", raw.projectId) : null;
        r.diaryId = raw.diaryId ? ref("diary", raw.diaryId) : null;
        if (!r.projectId && !r.diaryId) continue;
      }
      if (n === "settings" && keepSettings.has(String(r.key))) continue;
      rows.push(r);
    }
    out[n] = rows;
    if (n === "settings") {
      for (const r of rows) stmts.push(d.insert(schema.settings).values(r as InferInsertModel<typeof schema.settings>).onConflictDoUpdate({ target: [schema.settings.profileId, schema.settings.key], set: { value: r.value, updatedAt: new Date() } }));
      continue;
    }
    for (let i = 0; i < rows.length; i += 200) stmts.push(d.insert(TABLES[n] as PgTable).values(rows.slice(i, i + 200)));
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await d.batch(stmts as any);
  return summarize(out);
}

/** Snapshot folder per profile; "default" keeps the original backups/ folder. */
export const backupPrefix = (pid: string) => (pid === "default" ? "backups/" : `profiles/${pid}/backups/`);
export const KEEP = 7;

/** Daily snapshot of one profile to the private Blob store; keeps the newest KEEP. */
export async function snapshotToBlob(pid: string, now = new Date()) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN missing");
  const b = await collectBackup(pid);
  const name = `${backupPrefix(pid)}farmos-${dayIn(now, await getProfileTz(pid))}.json`;
  const blob = await put(name, JSON.stringify(b), { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true });
  const pruned = await pruneBackups(pid);
  return { pathname: blob.pathname, size: JSON.stringify(b).length, pruned, counts: summarize(b) };
}

export async function listBackups(pid: string) {
  const { blobs } = await list({ prefix: backupPrefix(pid), limit: 100 });
  // Only this profile's own snapshot files (never a nested profiles/ folder).
  return blobs.filter((b) => /^farmos-\d{4}-\d{2}-\d{2}\.json$/.test(b.pathname.slice(backupPrefix(pid).length))).sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt));
}

export async function pruneBackups(pid: string) {
  const all = await listBackups(pid);
  const old = all.slice(KEEP);
  if (old.length) await del(old.map((b) => b.url));
  return old.length;
}
