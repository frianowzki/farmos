// Usage: build, `next start -p 3123`, then: APP_PASSCODE=… FARMOS_PROFILE2_PASSCODE=… node scripts/test-profile-isolation.mjs
// Two-profile isolation test against a local `next start` build. Never prints passcodes.
const B = "http://localhost:3123";
const results = [];
const ok = (name, pass, extra = "") => { results.push({ name, pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`); };
async function login(code) {
  const r = await fetch(B + "/api/unlock", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "10.9." + Math.floor(Math.random()*250) + ".1" }, body: JSON.stringify({ passcode: code }) });
  const c = (r.headers.getSetCookie?.() ?? []).map((x) => x.split(";")[0]).join("; ");
  return { status: r.status, cookie: c };
}
const call = (jar) => async (method, path, body) => {
  const r = await fetch(B + path, { method, headers: { cookie: jar, ...(body !== undefined ? { "content-type": "application/json" } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined, redirect: "manual" });
  let j = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};
const today = new Date().toISOString().slice(0, 10);
const A = await login(process.env.APP_PASSCODE);
const P = await login(process.env.FARMOS_PROFILE2_PASSCODE);
const W = await login("definitely-wrong-passcode");
ok("default passcode unlocks", A.status === 200 && A.cookie.includes("frio_session"));
ok("profile-2 passcode unlocks", P.status === 200 && P.cookie.includes("frio_session"));
ok("wrong passcode rejected", W.status === 401);
ok("no session -> 401", (await call("")("GET", "/api/projects")).s === 401);
const a = call(A.cookie), p = call(P.cookie);
// Remove leftovers from an aborted earlier run.
for (const c of [a, p]) {
  for (const x of (await c("GET", "/api/projects")).j.projects.filter((x) => x.name.startsWith("ISO-"))) await c("DELETE", `/api/projects/${x.id}`);
  for (const x of (await c("GET", "/api/wallets")).j.wallets.filter((x) => (x.label ?? "").startsWith("ISO-"))) await c("DELETE", `/api/wallets/${x.id}`);
  for (const x of (await c("GET", "/api/diary")).j.entries.filter((x) => (x.title ?? "").startsWith("ISO-"))) await c("DELETE", `/api/diary/${x.id}`);
  for (const x of (await c("GET", "/api/tasks")).j.tasks.filter((x) => (x.title ?? "").startsWith("ISO-"))) await c("DELETE", `/api/tasks/${x.id}`);
}
ok("default profile id/name", (await a("GET", "/api/profile")).j?.id === "default");
const pp = (await p("GET", "/api/profile")).j;
ok("profile 2 id + default name Nadine", pp?.id === "p2" && pp?.name === "Nadine", JSON.stringify(pp));

async function seed(c, tag) {
  const proj = (await c("POST", "/api/projects", { name: `ISO-${tag}`, category: "airdrop" })).j.project;
  const task = (await c("POST", "/api/tasks", { title: `ISO-${tag}`, cadence: "daily", startDate: today, projectId: proj.id })).j.task;
  const diary = (await c("POST", "/api/diary", { day: today, title: `ISO-${tag}`, content: "x", projectIds: [proj.id] })).j.entry;
  const pos = (await c("POST", "/api/positions", { projectId: proj.id, token: `ISO${tag}`, size: 1, entryPrice: 1 })).j?.position;
  const wal = (await c("POST", "/api/wallets", { address: "0x000000000000000000000000000000000000dEaD", label: `ISO-${tag}` })).j.wallet;
  const mint = (await c("PATCH", `/api/mints/iso-test-${tag}`, { note: `ISO-${tag}` })).j?.watch;
  return { proj, task, diary, pos, wal, mint };
}
const S = { p2: await seed(p, "P2"), def: await seed(a, "DEF") };
ok("seeded both profiles", Boolean(S.p2.proj && S.p2.task && S.p2.diary && S.p2.pos && S.p2.wal && S.def.proj && S.def.wal), "");

async function attack(me, meName, other, o) {
  const tag = `${meName} vs other`;
  const lists = {
    projects: (await me("GET", "/api/projects")).j.projects.map((x) => x.id),
    tasks: (await me("GET", "/api/tasks")).j.tasks.map((x) => x.id),
    diary: (await me("GET", "/api/diary")).j.entries.map((x) => x.id),
    wallets: (await me("GET", "/api/wallets")).j.wallets.map((x) => x.id),
  };
  ok(`${tag}: list projects hides other`, !lists.projects.includes(o.proj.id));
  ok(`${tag}: list tasks hides other`, !lists.tasks.includes(o.task.id));
  ok(`${tag}: list diary hides other`, !lists.diary.includes(o.diary.id));
  ok(`${tag}: list wallets hides other (same address both)`, !lists.wallets.includes(o.wal.id));
  ok(`${tag}: GET other project -> 404`, (await me("GET", `/api/projects/${o.proj.id}`)).s === 404);
  const pr = await me("PATCH", `/api/projects/${o.proj.id}`, { name: "HACKED" });
  ok(`${tag}: PATCH other project rejected`, pr.s === 404, String(pr.s));
  await me("DELETE", `/api/projects/${o.proj.id}`);
  await me("PATCH", `/api/tasks/${o.task.id}`, { title: "HACKED" });
  await me("DELETE", `/api/tasks/${o.task.id}`);
  const tg = await me("POST", `/api/tasks/${o.task.id}/toggle`, { day: today, done: true });
  ok(`${tag}: toggle other task rejected`, tg.s >= 400, String(tg.s));
  await me("PATCH", `/api/diary/${o.diary.id}`, { title: "HACKED" });
  await me("DELETE", `/api/diary/${o.diary.id}`);
  if (o.pos) { await me("PATCH", `/api/positions/${o.pos.id}`, { token: "HACKED" }); await me("DELETE", `/api/positions/${o.pos.id}`); }
  const wp = await me("PATCH", `/api/wallets/${o.wal.id}`, { label: "HACKED" });
  ok(`${tag}: PATCH other wallet -> 404`, wp.s === 404, String(wp.s));
  await me("DELETE", `/api/wallets/${o.wal.id}`);
  const mine = await me("POST", "/api/tasks", { title: "ISO-steal", cadence: "daily", startDate: today, projectId: o.proj.id });
  ok(`${tag}: cannot attach task to other's project`, mine.s >= 400 || mine.j?.task?.projectId == null, String(mine.s));
  if (mine.j?.task) await me("DELETE", `/api/tasks/${mine.j.task.id}`);
  const dj = await me("POST", "/api/diary", { day: today, title: "ISO-steal", content: "x", projectIds: [o.proj.id] });
  ok(`${tag}: diary link to other's project stripped`, !(dj.j?.entry?.projectIds ?? []).includes(o.proj.id));
  if (dj.j?.entry) await me("DELETE", `/api/diary/${dj.j.entry.id}`);
  const mints = (await me("GET", "/api/mints")).j;
  ok(`${tag}: mint watch hides other`, !JSON.stringify(mints ?? {}).includes(o.mint?.note ?? "ISO-none"));
  const exp = await me("GET", "/api/export");
  ok(`${tag}: export excludes other`, !JSON.stringify(exp.j ?? {}).includes(o.proj.id));
  const ab = await me("GET", `/api/attachments?projectId=${o.proj.id}`);
  ok(`${tag}: attachments of other project empty`, (ab.j?.attachments ?? []).length === 0);
}
await attack(a, "default", p, S.p2);
await attack(p, "p2", a, S.def);

async function intact(c, s, tag) {
  const d = await c("GET", `/api/projects/${s.proj.id}`);
  const t = (await c("GET", "/api/tasks")).j.tasks.find((x) => x.id === s.task.id);
  const di = (await c("GET", "/api/diary")).j.entries.find((x) => x.id === s.diary.id);
  const w = (await c("GET", "/api/wallets")).j.wallets.find((x) => x.id === s.wal.id);
  ok(`${tag} data intact after attacks`, d.s === 200 && d.j.project.name === `ISO-${tag}` && t?.title === `ISO-${tag}` && di?.title === `ISO-${tag}` && w?.label === `ISO-${tag}` && (!s.pos || d.j.positions.some((x) => x.id === s.pos.id && x.token === `ISO${tag}`)));
}
await intact(p, S.p2, "P2");
await intact(a, S.def, "DEF");

// --- New tables: earnings, watchlist; claim watch; reports -----------------------------------
const EARN = {};
for (const [c, s, tag] of [[a, S.def, "DEF"], [p, S.p2, "P2"]]) {
  const e = await c("POST", "/api/earnings", { projectId: s.proj.id, symbol: `ISO${tag}`, coinId: "ethereum", amount: 1, valueAtClaim: 100, claimedAt: today, note: `ISO-${tag}` });
  EARN[tag] = e.j?.earning;
}
ok("earnings created in both profiles", Boolean(EARN.DEF && EARN.P2));
for (const [me, tag, other] of [[a, "default", "P2"], [p, "p2", "DEF"]]) {
  const o = EARN[other];
  const list = (await me("GET", "/api/earnings")).j?.earnings ?? [];
  ok(`${tag}: list earnings hides other`, !list.some((x) => x.id === o.id));
  ok(`${tag}: PATCH other earning -> 404`, (await me("PATCH", `/api/earnings/${o.id}`, { note: "HACKED" })).s === 404);
  ok(`${tag}: DELETE other earning -> 404`, (await me("DELETE", `/api/earnings/${o.id}`)).s === 404);
  const oProj = other === "P2" ? S.p2.proj.id : S.def.proj.id;
  const steal = await me("POST", "/api/earnings", { projectId: oProj, symbol: "ISOSTEAL", amount: 1, claimedAt: today });
  ok(`${tag}: cannot log earning on other's project`, steal.s === 404, String(steal.s));
  ok(`${tag}: claim watch on other's project rejected`, (await me("PUT", `/api/projects/${oProj}/checker`, { checker: { type: "manual", claimStatus: "open" } })).s === 404 && (await me("PATCH", `/api/projects/${oProj}/checker`, { claimStatus: "claimed" })).s === 404 && (await me("POST", `/api/projects/${oProj}/checker`)).s === 404);
  const rep = (await me("GET", `/api/reports?month=${today.slice(0, 7)}`)).j;
  ok(`${tag}: monthly report excludes other`, rep && !JSON.stringify(rep).includes(`ISO-${other}`) && !JSON.stringify(rep).includes(`ISO${other}`));
  const csv = await fetch(B + `/api/reports?month=${today.slice(0, 7)}&format=csv`, { headers: { cookie: me === a ? A.cookie : P.cookie } }).then((r) => r.text());
  ok(`${tag}: report CSV excludes other`, csv.includes("farmOS monthly report") && !csv.includes(`ISO-${other}`));
  const exp = (await me("GET", "/api/export")).j;
  ok(`${tag}: export excludes other's earnings`, !(exp.earnings ?? []).some((x) => x.id === o.id));
}
const mineE = (await a("GET", "/api/earnings")).j.earnings.find((x) => x.id === EARN.DEF.id);
ok("own earning intact after attacks", mineE?.note === "ISO-DEF");
ok("earning has live current value", typeof mineE?.currentUsd === "number" && mineE.currentUsd > 0, String(mineE?.currentUsd));
// claim status badge flow on own project
const cs = await a("PATCH", `/api/projects/${S.def.proj.id}/checker`, { claimStatus: "open" });
ok("own claim status set", cs.s === 200 && cs.j?.checker?.claimStatus === "open");

// Watchlist: same coin in both profiles, isolated rows
const WL = {};
for (const [c, tag] of [[a, "DEF"], [p, "P2"]]) {
  const before = (await c("GET", "/api/watchlist")).j?.items ?? [];
  const had = before.find((x) => x.coinId === "ethereum");
  const r = await c("POST", "/api/watchlist", { coinId: "ethereum" });
  WL[tag] = { item: had ?? r.j?.item, created: !had && Boolean(r.j?.item) };
}
ok("watchlist rows in both profiles", Boolean(WL.DEF.item && WL.P2.item && WL.DEF.item.id !== WL.P2.item.id));
for (const [me, tag, other] of [[a, "default", "P2"], [p, "p2", "DEF"]]) {
  const o = WL[other].item;
  const l = (await me("GET", "/api/watchlist")).j;
  ok(`${tag}: watchlist hides other`, !(l.items ?? []).some((x) => x.id === o.id));
  ok(`${tag}: watchlist has live price`, typeof l.prices?.ethereum?.usd === "number");
  ok(`${tag}: PATCH other watch -> 404`, (await me("PATCH", `/api/watchlist/${o.id}`, { above: 1 })).s === 404);
  ok(`${tag}: DELETE other watch -> 404`, (await me("DELETE", `/api/watchlist/${o.id}`)).s === 404);
}
// --- Gas & capital ledger (costs) ------------------------------------------------------------
const COST = {};
for (const [tag, c, s] of [["DEF", a, S.def], ["P2", p, S.p2]]) {
  const r = await c("POST", "/api/costs", { projectId: s.proj.id, type: "gas", symbol: "ETH", coinId: "ethereum", chain: "Base", amount: 0.01, valueAtEntry: 30, spentAt: today, note: `ISO-${tag}` });
  COST[tag] = r.j?.cost;
}
ok("costs created in both profiles", Boolean(COST.DEF && COST.P2 && COST.DEF.profileId === "default" && COST.P2.profileId === "p2"));
for (const [tag, me, o, oProj] of [["default vs p2", a, COST.P2, S.p2.proj.id], ["p2 vs default", p, COST.DEF, S.def.proj.id]]) {
  const list = (await me("GET", "/api/costs")).j?.costs ?? [];
  ok(`${tag}: list costs hides other`, !list.some((x) => x.id === o.id));
  ok(`${tag}: PATCH other cost -> 404`, (await me("PATCH", `/api/costs/${o.id}`, { note: "HACKED" })).s === 404);
  ok(`${tag}: DELETE other cost -> 404`, (await me("DELETE", `/api/costs/${o.id}`)).s === 404);
  ok(`${tag}: cost on other's project -> 404`, (await me("POST", "/api/costs", { projectId: oProj, type: "gas", symbol: "ETH", amount: 1, spentAt: today })).s === 404);
  const exp = (await me("GET", "/api/export")).j;
  ok(`${tag}: export excludes other's costs`, !(exp.costs ?? []).some((x) => x.id === o.id));
}
// --- Key-date times and custom link names -----------------------------------------------------
const kd = await a("PATCH", `/api/projects/${S.def.proj.id}`, { keyDates: { mint: today, times: { mint: "21:30" } }, links: { other: "https://example.com/check", "label.other": "Checker" } });
ok("key-date time + link label saved", kd.s === 200 && kd.j?.project?.keyDates?.times?.mint === "21:30" && kd.j?.project?.links?.["label.other"] === "Checker", String(kd.s));
ok("bad time rejected", (await a("PATCH", `/api/projects/${S.def.proj.id}`, { keyDates: { mint: today, times: { mint: "25:99" } } })).s === 400);
// --- NEAR / Canton watch addresses; bio lookup scoping -----------------------------------------
const nw = (await a("POST", "/api/wallets", { address: "ISO-Test.near", label: "ISO-NEAR" })).j?.wallet;
ok("NEAR named account saved as near", nw?.chain === "near" && nw?.address === "iso-test.near");
const cw = (await a("POST", "/api/wallets", { address: "ISO-party::1220" + "ab".repeat(32), label: "ISO-CANTON" })).j?.wallet;
ok("Canton party saved as canton", cw?.chain === "canton");
ok("p2 wallets hide default NEAR/Canton", !((await p("GET", "/api/wallets")).j?.wallets ?? []).some((x) => x.id === nw?.id || x.id === cw?.id));
for (const w of [nw, cw]) if (w) await a("DELETE", `/api/wallets/${w.id}`);
ok("bio lookup on other's project -> 404", (await p("GET", `/api/projects/${S.def.proj.id}/bio`)).s === 404);
ok("bio lookup needs a link", (await a("GET", `/api/projects/${S.def.proj.id}/bio`)).s === 422 || (await a("GET", `/api/projects/${S.def.proj.id}/bio`)).s === 404);
// --- Default wallet ----------------------------------------------------------------------------
{
  const before = ((await a("GET", "/api/wallets")).j?.wallets ?? []).find((x) => x.isDefault)?.id ?? null;
  const d1 = (await a("PATCH", `/api/wallets/${S.def.wal.id}`, { isDefault: true })).j?.wallet;
  ok("default: set default wallet", d1?.isDefault === true);
  const list = (await a("GET", "/api/wallets")).j?.wallets ?? [];
  ok("default: exactly one default, listed first", list.filter((x) => x.isDefault).length === 1 && list[0]?.id === S.def.wal.id);
  ok("p2 can't set default on default's wallet", (await p("PATCH", `/api/wallets/${S.def.wal.id}`, { isDefault: true })).s === 404);
  const p2prev = ((await p("GET", "/api/wallets")).j?.wallets ?? []).find((x) => x.isDefault)?.id ?? null;
  const p2d = (await p("PATCH", `/api/wallets/${S.p2.wal.id}`, { isDefault: true })).j?.wallet;
  ok("p2 default is independent", p2d?.isDefault === true && ((await a("GET", "/api/wallets")).j?.wallets ?? []).some((x) => x.id === S.def.wal.id && x.isDefault));
  const cw = (await a("POST", "/api/costs", { projectId: S.def.proj.id, type: "gas", symbol: "ETH", amount: 0.001, spentAt: today, wallet: S.def.wal.address })).j?.cost;
  ok("cost keeps the picked wallet", cw?.wallet === S.def.wal.address);
  if (cw) await a("DELETE", `/api/costs/${cw.id}`);
  // restore the previous default (wallets of the test are deleted at the end anyway)
  if (before && before !== S.def.wal.id) await a("PATCH", `/api/wallets/${before}`, { isDefault: true });
  else await a("PATCH", `/api/wallets/${S.def.wal.id}`, { isDefault: false });
  if (p2prev) await p("PATCH", `/api/wallets/${p2prev}`, { isDefault: true });
  else await p("PATCH", `/api/wallets/${S.p2.wal.id}`, { isDefault: false });
}
// --- Saved wire items -------------------------------------------------------------------------
const sv = (await p("POST", "/api/feed", { title: "ISO-P2 saved headline", url: "https://example.com/iso-p2", summary: "x", source: "ISO", category: "news" })).j;
ok("p2 saved a wire item", Boolean(sv?.id));
ok("default reading list hides p2 saved item", !((await a("GET", "/api/feed")).j?.items ?? []).some((x) => x.id === sv?.id));
await a("DELETE", `/api/feed?id=${sv?.id}`);
ok("default can't delete p2 saved item", ((await p("GET", "/api/feed")).j?.items ?? []).some((x) => x.id === sv?.id));
await p("DELETE", `/api/feed?id=${sv?.id}`);
// --- Research desk dashboard tools (probe; only with AI_TOOL_PROBE=1 locally) ------------------
const probe = (c) => (tool, args = {}) => c("POST", "/api/assistant/probe", { tool, args });
if ((await probe(a)("listProjects")).s === 404) {
  console.log("SKIP  AI tool probe disabled (set AI_TOOL_PROBE=1 for next start)");
} else {
  for (const [tag, me, mine, other] of [["default", a, S.def, S.p2], ["p2", p, S.p2, S.def]]) {
    const pr = probe(me);
    const lp = (await pr("listProjects")).j?.out;
    ok(`tools/${tag}: listProjects has own, hides other`, lp?.projects?.some((x) => x.id === mine.proj.id) && !lp.projects.some((x) => x.id === other.proj.id));
    const gp = (await pr("getProject", { id: other.proj.id })).j?.out;
    ok(`tools/${tag}: getProject(other id) not found`, gp?.error === "not found");
    const gpn = (await pr("getProject", { name: other.proj.name })).j?.out;
    ok(`tools/${tag}: getProject(other name) not found`, gpn?.error === "not found");
    const tt = (await pr("todayTasks")).j?.out;
    ok(`tools/${tag}: todayTasks hides other`, !(tt?.tasks ?? []).some((x) => x.title === other.task.title) && (tt?.tasks ?? []).some((x) => x.title === mine.task.title));
    const roi = JSON.stringify((await pr("earningsRoi")).j?.out ?? {});
    ok(`tools/${tag}: earningsRoi hides other`, !roi.includes(other.proj.name) && roi.includes(mine.proj.name));
    const cl = JSON.stringify((await pr("claimableSoon", { days: 30 })).j?.out ?? {});
    ok(`tools/${tag}: claimableSoon hides other`, !cl.includes(other.proj.name));
    const rc = JSON.stringify((await pr("recapCalendar", { days: 3 })).j?.out ?? {});
    ok(`tools/${tag}: recapCalendar hides other`, !rc.includes(other.proj.name) && !rc.includes(other.diary.title));
    const rl = JSON.stringify((await pr("readingList")).j?.out ?? {});
    ok(`tools/${tag}: readingList scoped`, !rl.includes(`ISO-${tag === "default" ? "P2" : "DEF"}`));
    const ul = JSON.stringify((await pr("untrackedLeads")).j?.out?.trackedNames ?? []);
    ok(`tools/${tag}: untrackedLeads tracked names scoped`, !ul.includes(other.proj.name.toLowerCase()));
    const pf = JSON.stringify((await pr("portfolio")).j?.out ?? {});
    ok(`tools/${tag}: portfolio has no full addresses`, !/0x[0-9a-fA-F]{40}/.test(pf));
    const all = JSON.stringify([lp, gp, tt, roi, cl, rc, rl, pf]);
    ok(`tools/${tag}: no secrets in tool output`, !/(apiKey|api_key|access_token|refresh_token|chatId|passcode)/i.test(all));
  }
  ok("tools: unknown tool rejected", (await probe(a)("proposeProject")).s === 400);
}
const pr = (await a("GET", "/api/profile")).j, pr2 = (await p("GET", "/api/profile")).j;
ok("default fiat: USD for both", pr.fiat === "usd" && pr2.fiat === "usd", `${pr.fiat}/${pr2.fiat}`);
const px = (await a("GET", "/api/prices?ids=ethereum,tether")).j?.prices;
ok("prices endpoint returns usd/idr/php/usdt", px?.ethereum && ["usd", "idr", "php", "usdt"].every((k) => px.ethereum[k] > 0));
ok("prices endpoint needs a session", (await call("")("GET", "/api/prices?ids=ethereum")).s === 401);
for (const tag of ["DEF", "P2"]) if (WL[tag].created) await (tag === "DEF" ? a : p)("DELETE", `/api/watchlist/${WL[tag].item.id}`);

// Import into p2 a backup that contains default's ids: must create fresh p2 rows, never overwrite default.
const defExport = (await a("GET", "/api/export")).j;
const p2Before = (await p("GET", "/api/export")).j;
const imp = await p("POST", "/api/import?confirm=1", defExport);
ok("p2 import of default's backup accepted", imp.s === 200, String(imp.s));
const defAfter = (await a("GET", "/api/projects")).j.projects.map((x) => x.id).sort();
ok("default projects unchanged after p2 import", JSON.stringify(defAfter) === JSON.stringify(defExport.data?.projects?.map((x) => x.id).sort() ?? defExport.projects?.map((x) => x.id).sort()));
const p2Proj = (await p("GET", "/api/projects")).j.projects;
ok("p2 imported rows got new ids", p2Proj.length > 0 && !p2Proj.some((x) => defAfter.includes(x.id)));
// Restore p2 to its pre-import state.
const rest = await p("POST", "/api/import?confirm=1", p2Before);
ok("p2 restored own backup", rest.s === 200);

// Settings name per profile
await p("PUT", "/api/profile", { name: "Nadine Test" });
ok("p2 name change isolated", (await a("GET", "/api/profile")).j.name !== "Nadine Test" && (await p("GET", "/api/profile")).j.name === "Nadine Test");
await p("PUT", "/api/profile", { name: "Nadine" });

// Cleanup
for (const [c, s] of [[a, S.def], [p, S.p2]]) {
  await c("DELETE", `/api/wallets/${s.wal.id}`);
  if (s.mint) await c("DELETE", `/api/mints/${s.mint.slug}`);
  await c("DELETE", `/api/diary/${s.diary.id}`);
  await c("DELETE", `/api/tasks/${s.task.id}`);
  if (s.pos) await c("DELETE", `/api/positions/${s.pos.id}`);
  await c("DELETE", `/api/projects/${s.proj.id}`);
}
// The p2 restore re-created its rows under fresh ids, so also sweep by marker.
for (const c of [a, p]) {
  for (const x of (await c("GET", "/api/projects")).j.projects.filter((x) => x.name.startsWith("ISO-"))) await c("DELETE", `/api/projects/${x.id}`);
  for (const x of (await c("GET", "/api/wallets")).j.wallets.filter((x) => (x.label ?? "").startsWith("ISO-"))) await c("DELETE", `/api/wallets/${x.id}`);
  for (const x of (await c("GET", "/api/diary")).j.entries.filter((x) => (x.title ?? "").startsWith("ISO-"))) await c("DELETE", `/api/diary/${x.id}`);
  for (const x of (await c("GET", "/api/tasks")).j.tasks.filter((x) => (x.title ?? "").startsWith("ISO-"))) await c("DELETE", `/api/tasks/${x.id}`);
  for (const x of ((await c("GET", "/api/mints")).j?.watch ?? []).filter((x) => String(x.slug).startsWith("iso-test-"))) await c("DELETE", `/api/mints/${x.slug}`);
}
const leftovers = [...(await a("GET", "/api/projects")).j.projects, ...(await p("GET", "/api/projects")).j.projects].filter((x) => x.name.startsWith("ISO-"));
ok("test data cleaned up", leftovers.length === 0);
const f = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - f}/${results.length} passed`);
process.exit(f ? 1 : 0);
