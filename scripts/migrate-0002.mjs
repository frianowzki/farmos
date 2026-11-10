// Additive migration: backs up every table to /workspace/backups (0600) first, applies
// drizzle/0002_costs.sql in one transaction, then verifies row counts are unchanged.
// Usage: node scripts/migrate-0002.mjs [--apply]
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { readFileSync, writeFileSync, mkdirSync, chmodSync } from "node:fs";
config({ path: ".env.local", quiet: true });
const sql = neon(process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL);
const tables = (await sql`select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`).map((r) => r.table_name);
const counts = async () => Object.fromEntries(await Promise.all(tables.map(async (t) => [t, Number((await sql.query(`select count(*)::int as n from "${t}"`))[0].n)])));
const before = await counts();
const dump = {};
for (const t of tables) dump[t] = await sql.query(`select * from "${t}"`);
mkdirSync("/workspace/backups", { recursive: true, mode: 0o700 });
const file = `/workspace/backups/pre-0002-${Date.now()}.json`;
writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), counts: before, tables: dump }), { mode: 0o600 });
chmodSync(file, 0o600);
console.log("backup:", file, JSON.stringify(before));
if (!process.argv.includes("--apply")) { console.log("dry run; pass --apply"); process.exit(0); }
const stmts = readFileSync("drizzle/0002_costs.sql", "utf8").split(";").map((s) => s.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean);
await sql.transaction(stmts.map((s) => sql.query(s)));
const after = await counts();
const changed = Object.keys(before).filter((t) => before[t] !== after[t]);
console.log("applied", stmts.length, "statements; new tables:", Object.keys(after).filter((t) => !(t in before)).join(", ") || "none");
console.log(changed.length ? `ROW COUNT CHANGED: ${changed.join(", ")}` : "row counts intact");
const cols = await sql`select column_name from information_schema.columns where table_name = 'costs' and column_name = 'profile_id'`;
console.log("costs.profile_id:", cols.length ? "present" : "MISSING");

