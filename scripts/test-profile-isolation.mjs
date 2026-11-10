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
