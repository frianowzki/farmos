import "server-only";
import { del, list, put } from "@vercel/blob";
import { getTableColumns, type InferInsertModel } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db, schema } from "@/db";
import { dayIn } from "./tz";
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

export async function collectBackup(): Promise<Backup> {
  const d = db();
  const entries = await Promise.all(TABLE_NAMES.map(async (n) => [n, (await d.select().from(TABLES[n] as PgTable)) as Record<string, unknown>[]] as const));
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

/**
 * Replace all data with the backup in ONE transaction (neon-http batch).
 * Secret-bearing settings already in the DB (ai key, notify) are kept.
 */
export async function restoreBackup(b: Backup) {
  const d = db();
  const reverse = [...TABLE_NAMES].reverse();
  const keepSettings = new Set(["ai", "notify"]);
  const stmts = [] as unknown[];
  for (const n of reverse) {
    if (n === "settings") continue;
    stmts.push(d.delete(TABLES[n] as PgTable));
  }
  for (const n of TABLE_NAMES) {
    const rows = (b[n] ?? []).map((r) => revive(n, r));
    if (n === "settings") {
      for (const r of rows) {
        if (keepSettings.has(String(r.key))) continue;
        stmts.push(d.insert(schema.settings).values(r as InferInsertModel<typeof schema.settings>).onConflictDoUpdate({ target: schema.settings.key, set: { value: r.value, updatedAt: new Date() } }));
      }
      continue;
    }
    for (let i = 0; i < rows.length; i += 200) stmts.push(d.insert(TABLES[n] as PgTable).values(rows.slice(i, i + 200)));
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await d.batch(stmts as any);
  return summarize(b);
}

const PREFIX = "backups/";
export const KEEP = 7;

/** Daily snapshot to the private Blob store; keeps the newest KEEP. */
export async function snapshotToBlob(now = new Date()) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN missing");
  const b = await collectBackup();
  const name = `${PREFIX}farmos-${dayIn(now)}.json`;
  const blob = await put(name, JSON.stringify(b), { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true });
  const pruned = await pruneBackups();
  return { pathname: blob.pathname, size: JSON.stringify(b).length, pruned, counts: summarize(b) };
}

export async function listBackups() {
  const { blobs } = await list({ prefix: PREFIX, limit: 100 });
  return blobs.sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt));
}

export async function pruneBackups() {
  const all = await listBackups();
  const old = all.slice(KEEP);
  if (old.length) await del(old.map((b) => b.url));
  return old.length;
}
