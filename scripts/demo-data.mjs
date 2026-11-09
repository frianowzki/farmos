// Temporary demo data for screenshots only. `node scripts/demo-data.mjs <base> seed|clean`
import fs from "node:fs";
const [base, cmd] = process.argv.slice(2);
let cookie = "";
const call = async (method, path, body) => {
  const r = await fetch(base + path, { method, headers: { "content-type": "application/json", cookie }, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.get("set-cookie");
  if (sc) cookie = sc.split(";")[0];
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path} ${r.status} ${JSON.stringify(j)}`);
  return j;
};
await call("POST", "/api/unlock", { passcode: process.env.FRIO_PASSCODE });
const file = "/tmp/frioos-demo-ids.json";
if (cmd === "clean") {
  const ids = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const id of ids.diary) await call("DELETE", `/api/diary/${id}`);
  for (const id of ids.tasks) await call("DELETE", `/api/tasks/${id}`);
  for (const id of ids.projects) await call("DELETE", `/api/projects/${id}`);
  const left = await call("GET", "/api/projects");
  console.log("cleaned; remaining projects:", left.projects.length);
  fs.unlinkSync(file);
  process.exit(0);
}
const day = (d) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toLocaleDateString("en-CA"); };
const ids = { projects: [], tasks: [], diary: [] };
const P = [
  { name: "[demo] Monad", category: "testnet", status: "active", chains: ["Monad"], priority: "high", tier: "S", risk: "low", rating: 5, accent: "violet", campaignStart: day(-20), campaignEnd: day(40), summary: "Daily swaps + NFT mints on testnet, Discord roles.", keyDates: { snapshot: day(9) }, costSpent: 0, tags: ["quests"] },
  { name: "[demo] Ink points", category: "airdrop", status: "waiting", chains: ["Ink"], priority: "medium", tier: "A", risk: "low", rating: 4, accent: "blue", summary: "Bridged + weekly LP. Waiting on season 2.", deadline: day(3), costSpent: 41.5, capitalDeployed: 300, rewardsReceived: 0 },
  { name: "[demo] Pudgy Rods WL", category: "nft", status: "claimable", chains: ["Ethereum"], priority: "urgent", tier: "B", risk: "medium", rating: 3, summary: "GTD spot won, mint window opens soon.", keyDates: { mint: day(1) }, costSpent: 6 },
  { name: "[demo] BRETT rotation", category: "degen", status: "active", chains: ["Base"], priority: "medium", tier: "C", risk: "high", rating: 2, accent: "red", summary: "Momentum play, stop at −30%.", costSpent: 3.2 },
  { name: "[demo] Hyperlane", category: "airdrop", status: "done", chains: ["Arbitrum", "Base"], priority: "low", tier: "A", risk: "low", summary: "Claimed and sold.", costSpent: 28, rewardsReceived: 412 },
];
for (const p of P) ids.projects.push((await call("POST", "/api/projects", p)).project.id);
await call("POST", "/api/positions", { projectId: ids.projects[3], token: "BRETT", chain: "Base", size: 4200, entryPrice: 0.071, currentPrice: 0.083, status: "open" });
await call("POST", "/api/positions", { projectId: ids.projects[3], token: "TOSHI", chain: "Base", size: 900000, entryPrice: 0.00031, exitPrice: 0.00027, status: "closed" });
await call("POST", "/api/positions", { projectId: ids.projects[1], token: "INK", chain: "Ink", size: 1200, entryPrice: 0.25, currentPrice: 0.21, status: "open" });
const T = [
  { title: "Monad faucet + 3 swaps", projectId: ids.projects[0] },
  { title: "Discord GM + role check", projectId: ids.projects[0] },
  { title: "Check Ink LP range", projectId: ids.projects[1], cadence: "weekly", weekdays: [] },
  { title: "Scan new pools on Base", projectId: null },
];
for (const t of T) ids.tasks.push((await call("POST", "/api/tasks", { cadence: "daily", startDate: day(-40), ...t })).task.id);
for (let i = 1; i < 40; i++) for (const [k, id] of ids.tasks.entries()) if ((i * 7 + k * 3) % 5 !== 0 || i < 6) await call("POST", `/api/tasks/${id}/toggle`, { day: day(-i), done: true });
await call("POST", `/api/tasks/${ids.tasks[1]}/toggle`, { day: day(0), done: true });
ids.diary.push((await call("POST", "/api/diary", { day: day(-3), title: "Ink LP rebalance", content: "<p>Moved range up after the pump. Fees ok.</p>", projectIds: [ids.projects[1]] })).entry.id);
ids.diary.push((await call("POST", "/api/diary", { day: day(-1), title: "Monad week 3", content: "<p>Faucet slower today. Swapped on 3 dexes, minted 1 NFT.</p>", projectIds: [ids.projects[0]] })).entry.id);
fs.writeFileSync(file, JSON.stringify(ids));
console.log("seeded", ids.projects.length, "projects");
