// One-time: normalise projects.chains to the supported list (lib/chain-meta). Aliases map to the
// canonical name (BNB → BSC, Hyperliquid → HyperEVM…). Unsupported chains are not lost: they move
// into tags as "chain:<name>". Usage: node scripts/migrate-chains.mjs [--apply]
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
config({ path: ".env.local" });
const { CHAINS } = await import("../src/lib/chain-meta.ts").catch(() => ({ CHAINS: null }));
if (!CHAINS) throw new Error("run with: npx tsx scripts/migrate-chains.mjs");
const norm = (s) => s.toLowerCase().replace(/[\s_-]+/g, " ").trim();
const find = (q) => {
  const s = norm(q), c = s.replace(/\s/g, "");
  return CHAINS.find((x) => x.key === c || norm(x.name) === s || norm(x.name).replace(/\s/g, "") === c || x.aliases.some((a) => norm(a) === s || a.replace(/\s/g, "") === c));
};
const sql = neon(process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL);
const rows = await sql`select id, name, chains, tags from projects`;
const apply = process.argv.includes("--apply");
let changed = 0;
for (const r of rows) {
  const keep = [], moved = [];
  for (const c of r.chains ?? []) {
    const m = find(c);
    if (m) { if (!keep.includes(m.name)) keep.push(m.name); } else moved.push(`chain:${c}`);
  }
  const tags = [...new Set([...(r.tags ?? []), ...moved])];
  if (JSON.stringify(keep) === JSON.stringify(r.chains ?? []) && tags.length === (r.tags ?? []).length) continue;
  changed++;
  console.log(`${r.name}: [${(r.chains ?? []).join(", ")}] -> [${keep.join(", ")}]${moved.length ? ` (+tags ${moved.join(", ")})` : ""}`);
  if (apply) await sql`update projects set chains = ${keep}, tags = ${tags}, updated_at = now() where id = ${r.id}`;
}
const pos = await sql`select id, chain from positions where chain is not null`;
for (const p of pos) {
  const m = find(p.chain);
  if (m && m.name !== p.chain) {
    changed++;
    console.log(`position ${p.id}: ${p.chain} -> ${m.name}`);
    if (apply) await sql`update positions set chain = ${m.name} where id = ${p.id}`;
  }
}
console.log(`${rows.length} projects, ${pos.length} positions checked, ${changed} to change${apply ? " (applied)" : " (dry run)"}`);
const cols = await sql`select column_name from information_schema.columns where table_name = 'wallets'`;
console.log("wallets columns:", cols.map((c) => c.column_name).join(", "));
