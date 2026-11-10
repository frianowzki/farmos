import "server-only";
import { and, desc, eq, gte } from "drizzle-orm";
import { db, schema } from "@/db";
import { claimBadge } from "@/lib/claim";
import { addDays, diffDays } from "@/lib/dates";
import { projectDates } from "@/lib/project-utils";
import { projectPnl } from "@/lib/pnl";
import { isDue, isSatisfied } from "@/lib/streak";
import { costsWithValue } from "./costs";
import { earningsWithValue } from "./earnings";
import { getNews } from "./news";
import { getNfts } from "./nfts";
import { listDropsRich, openseaConfigured } from "./opensea";
import { getPrices, searchCoins } from "./prices";
import { getProfileTz } from "./settings";
import { dayIn } from "./tz";
import { getCachedTrack } from "./wallet-track";

/**
 * Read-only views of the dashboard for the research desk. Every query is scoped to `pid`;
 * nothing here writes, signs or returns secrets (tokens, API keys, Telegram ids, full addresses).
 */
const short = (a: string) => (a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);
const plain = (html: string, n: number) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const linkView = (links: Record<string, string | undefined> | null | undefined) => {
  const l = links ?? {};
  return Object.fromEntries(Object.entries(l).filter(([k, v]) => v && !k.startsWith("label.")).map(([k, v]) => [l[`label.${k}`]?.trim() || k, v]));
};

async function todayFor(pid: string) {
  const tz = await getProfileTz(pid);
  return { tz, today: dayIn(new Date(), tz) };
}

async function projectsOf(pid: string) {
  return db().select().from(schema.projects).where(eq(schema.projects.profileId, pid)).orderBy(desc(schema.projects.updatedAt)).limit(300);
}

export async function dashProjects(pid: string, q: { query?: string; category?: string; status?: string } = {}) {
  const { today } = await todayFor(pid);
  const s = q.query?.trim().toLowerCase();
  const rows = (await projectsOf(pid)).filter((p) =>
    (!q.category || p.category === q.category) && (!q.status || p.status === q.status) &&
    (!s || [p.name, p.summary ?? "", ...p.tags, ...p.chains].join(" ").toLowerCase().includes(s)));
  return {
    today,
    count: rows.length,
    projects: rows.slice(0, 120).map((p) => ({
      id: p.id, name: p.name, category: p.category, status: p.status, tier: p.tier, risk: p.risk, eligibility: p.eligibility, chains: p.chains, tags: p.tags,
      summary: p.summary?.slice(0, 200) ?? null,
      dates: projectDates(p).map((d) => ({ label: d.label, day: d.day, time: d.time ?? null, inDays: diffDays(d.day, today) })),
      claim: claimBadge(p, today)?.label ?? null,
    })),
  };
}

export async function dashProject(pid: string, idOrName: string) {
  const all = await projectsOf(pid);
  const s = idOrName.trim().toLowerCase();
  const p = all.find((x) => x.id === idOrName) ?? all.find((x) => x.name.toLowerCase() === s) ?? all.find((x) => x.name.toLowerCase().includes(s));
  if (!p) return { error: "not found" };
  const { today } = await todayFor(pid);
  const [positions, tasks, earnings, costs] = await Promise.all([
    db().select().from(schema.positions).where(and(eq(schema.positions.profileId, pid), eq(schema.positions.projectId, p.id))),
    db().select().from(schema.tasks).where(and(eq(schema.tasks.profileId, pid), eq(schema.tasks.projectId, p.id))),
    earningsWithValue(pid).then((r) => r.filter((x) => x.projectId === p.id)),
    costsWithValue(pid).then((r) => r.filter((x) => x.projectId === p.id)),
  ]);
  const c = p.checker;
  return {
    id: p.id, name: p.name, category: p.category, status: p.status, tier: p.tier, risk: p.risk, eligibility: p.eligibility, chains: p.chains, tags: p.tags, rating: p.rating,
    summary: p.summary, links: linkView(p.links as Record<string, string>), source: p.source,
    dates: projectDates(p).map((d) => ({ label: d.label, day: d.day, time: d.time ?? null, inDays: diffDays(d.day, today) })),
    campaign: { start: p.campaignStart, end: p.campaignEnd },
    claim: { badge: claimBadge(p, today)?.label ?? null, watch: c ? { type: c.type, status: c.claimStatus ?? null, lastRun: c.lastRun ? { at: c.lastRun.at, results: c.lastRun.results.map((r) => ({ wallet: short(r.wallet ?? ""), status: r.status, amount: r.amount ?? null })) } : null } : null },
    money: { manual: { gasSpent: p.costSpent, capital: p.capitalDeployed, rewards: p.rewardsReceived }, pnl: projectPnl(p, positions) },
    ledger: costs.map((x) => ({ type: x.type, amount: x.amount, symbol: x.symbol, chain: x.chain, usdAtEntry: x.valueAtEntry, usdNow: x.currentUsd, day: x.spentAt })),
    earnings: earnings.map((x) => ({ symbol: x.symbol, amount: x.amount, usdAtClaim: x.valueAtClaim, usdNow: x.currentUsd, day: x.claimedAt })),
    tasks: tasks.map((t) => ({ title: t.title, cadence: t.cadence, active: t.active })),
    positions: positions.map((x) => ({ token: x.token, size: x.size, entry: x.entryPrice, current: x.currentPrice, status: x.status })),
    notes: plain(p.notes, 3000),
  };
}

export async function dashClaimable(pid: string, days = 14) {
  const { today } = await todayFor(pid);
  const out = [];
  for (const p of await projectsOf(pid)) {
    if (["done", "dropped"].includes(p.status)) continue;
    const badge = claimBadge(p, today);
    const dates = projectDates(p).filter((d) => ["claimStart", "claimEnd", "tge", "snapshot", "deadline", "mint"].includes(d.kind)).map((d) => ({ label: d.label, day: d.day, time: d.time ?? null, inDays: diffDays(d.day, today) })).filter((d) => d.inDays >= -1 && d.inDays <= days);
    if (p.status === "claimable" || badge?.id === "open" || badge?.id === "eligible" || badge?.id === "upcoming" || dates.length) out.push({ name: p.name, id: p.id, status: p.status, claim: badge?.label ?? null, dates });
  }
  out.sort((a, b) => (a.dates[0]?.inDays ?? 99) - (b.dates[0]?.inDays ?? 99));
  return { today, withinDays: days, projects: out };
}

export async function dashTasks(pid: string) {
  const { today } = await todayFor(pid);
  const tasks = await db().select().from(schema.tasks).where(and(eq(schema.tasks.profileId, pid), eq(schema.tasks.active, true)));
  const comps = await db().select().from(schema.taskCompletions).where(and(eq(schema.taskCompletions.profileId, pid), gte(schema.taskCompletions.day, addDays(today, -7))));
  const names = new Map((await projectsOf(pid)).map((p) => [p.id, p.name]));
  return {
    today,
    tasks: tasks.filter((t) => isDue({ ...t, weekdays: t.weekdays ?? [] }, today)).map((t) => {
      const done = new Set(comps.filter((c) => c.taskId === t.id).map((c) => c.day));
      return { title: t.title, project: t.projectId ? names.get(t.projectId) ?? null : null, cadence: t.cadence, doneToday: done.has(today), satisfied: isSatisfied({ ...t, weekdays: t.weekdays ?? [] }, today, done) };
    }),
  };
}

export async function dashPortfolio(pid: string) {
  const [t, saved] = await Promise.all([getCachedTrack(pid), db().select({ address: schema.wallets.address, label: schema.wallets.label, chain: schema.wallets.chain, isDefault: schema.wallets.isDefault }).from(schema.wallets).where(eq(schema.wallets.profileId, pid))]);
  const def = saved.find((w) => w.isDefault);
  const defaultWallet = def ? { label: def.label || short(def.address), address: short(def.address), chain: def.chain || null } : null;
  if (!t) return { defaultWallet, note: "No wallet snapshot yet. Open Wallets once to load balances." };
  const isDef = (a: string) => Boolean(def && def.address.toLowerCase() === a.toLowerCase());
  return {
    fetchedAt: t.fetchedAt, totalUsd: t.totalUsd, defaultWallet,
    wallets: [...t.wallets].sort((a, b) => Number(isDef(b.address)) - Number(isDef(a.address))).map((w) => ({ label: w.label || short(w.address), address: short(w.address), isDefault: isDef(w.address), totalUsd: w.totalUsd, top: [...w.holdings].sort((a, b) => (b.usd ?? 0) - (a.usd ?? 0)).slice(0, 6).map((h) => ({ chain: h.chain, symbol: h.symbol, amount: h.amount, usd: h.usd })) })),
    positions: t.positions.map((p) => ({ project: p.projectName, token: p.token, chain: p.chain, value: p.value, pnl: p.pnl })),
  };
}

export async function dashRoi(pid: string) {
  const [projects, positions, earnings, costs] = await Promise.all([projectsOf(pid), db().select().from(schema.positions).where(eq(schema.positions.profileId, pid)), earningsWithValue(pid), costsWithValue(pid)]);
  const rows = projects.map((p) => {
    const e = earnings.filter((x) => x.projectId === p.id);
    const c = costs.filter((x) => x.projectId === p.id);
    const earned = e.reduce((a, x) => a + (x.currentUsd ?? x.valueAtClaim ?? 0), 0) || p.rewardsReceived;
    const ledger = c.reduce((a, x) => a + (x.valueAtEntry ?? x.currentUsd ?? 0), 0);
    const spent = ledger + p.costSpent + p.capitalDeployed;
    const pnl = projectPnl(p, positions.filter((x) => x.projectId === p.id));
    return { name: p.name, status: p.status, spentUsd: Math.round(spent * 100) / 100, gasUsd: c.filter((x) => x.type === "gas").reduce((a, x) => a + (x.valueAtEntry ?? 0), 0) + p.costSpent, earnedUsd: Math.round(earned * 100) / 100, roi: spent > 0 ? (earned - spent) / spent : null, positionsNet: pnl.net };
  }).filter((r) => r.spentUsd || r.earnedUsd || r.positionsNet);
  rows.sort((a, b) => (b.roi ?? -99) - (a.roi ?? -99));
  const spent = rows.reduce((a, r) => a + r.spentUsd, 0);
  const earned = rows.reduce((a, r) => a + r.earnedUsd, 0);
  return { totals: { spentUsd: spent, earnedUsd: earned, roi: spent > 0 ? (earned - spent) / spent : null }, projects: rows };
}

export async function dashNews(pid: string, q: { query?: string; category?: string; relevantOnly?: boolean; limit?: number } = {}) {
  const wire = await getNews(false);
  const names = (await projectsOf(pid)).filter((p) => p.status !== "dropped").map((p) => p.name.toLowerCase()).filter((n) => n.length >= 3);
  const s = q.query?.trim().toLowerCase();
  let items = wire.items.map((i) => ({ ...i, mentions: names.filter((n) => `${i.title} ${i.summary}`.toLowerCase().includes(n)) }));
  if (q.category) items = items.filter((i) => i.category === q.category);
  if (s) items = items.filter((i) => `${i.title} ${i.summary} ${i.source}`.toLowerCase().includes(s));
  if (q.relevantOnly) items = items.filter((i) => i.mentions.length);
  return { fetchedAt: wire.fetchedAt, count: items.length, items: items.slice(0, Math.min(q.limit ?? 25, 50)).map((i) => ({ title: i.title, source: i.source, url: i.url, at: i.publishedAt, category: i.category, summary: i.summary.slice(0, 220), mentionsYourProjects: i.mentions })) };
}

export async function dashReading(pid: string) {
  const rows = await db().select().from(schema.feedItems).where(eq(schema.feedItems.profileId, pid)).orderBy(desc(schema.feedItems.day), desc(schema.feedItems.score)).limit(40);
  return { items: rows.map((r) => ({ day: r.day, kind: r.kind, title: r.title, summary: r.summary.slice(0, 240), url: r.url, source: r.source, category: r.category, score: r.score })) };
}

export async function dashMints(pid: string) {
  const watch = await db().select().from(schema.mintWatch).where(eq(schema.mintWatch.profileId, pid));
  const w = new Map(watch.map((x) => [x.slug, x]));
  if (!openseaConfigured()) return { configured: false, watching: watch.map((x) => ({ name: x.name ?? x.slug, manual: x.manualStatus })) };
  const drops = await listDropsRich(60).catch(() => []);
  const verdict = (slug: string) => {
    const a = w.get(slug)?.auto as { wallets?: { verdict: string }[] } | null | undefined;
    if (!a?.wallets?.length) return null;
    return a.wallets.some((x) => x.verdict === "eligible") ? "eligible" : a.wallets.every((x) => x.verdict === "not_eligible") ? "not eligible" : "unknown";
  };
  return {
    configured: true,
    drops: drops.slice(0, 40).map((d) => ({ name: d.collection_name ?? d.collection_slug, slug: d.collection_slug, chain: d.chain, minting: d.is_minting, kinds: d.kinds, start: (d.active_stage ?? d.next_stage)?.start_time ?? null, url: d.opensea_url, watching: w.has(d.collection_slug), manualStatus: w.get(d.collection_slug)?.manualStatus ?? null, eligibility: verdict(d.collection_slug) })),
  };
}

export async function dashNfts(pid: string) {
  const n = await getNfts(pid, false).catch((e: Error) => ({ error: e.message }) as const);
  if ("error" in n) return n;
  if (!n.configured) return { configured: false };
  return { fetchedAt: n.fetchedAt, totalUsd: n.totalUsd, count: n.count, hiddenWithoutVolume: n.hidden ?? 0, collections: n.collections.slice(0, 40).map((c) => ({ name: c.name, chain: c.chain, count: c.count, floor: c.floor, symbol: c.symbol, usd: c.usd })) };
}

export async function dashPrice(q: { coins: string[]; amount?: number }) {
  const ids: string[] = [];
  for (const c of q.coins.slice(0, 8)) {
    const hit = (await searchCoins(c)).find((h) => h.id === c.toLowerCase() || h.symbol.toLowerCase() === c.toLowerCase()) ?? (await searchCoins(c))[0];
    if (hit) ids.push(hit.id);
  }
  const px = await getPrices(ids);
  const amt = q.amount ?? 1;
  return { amount: amt, quotes: Object.entries(px).map(([id, p]) => ({ id, usd: p.usd * amt, usdt: p.usdt * amt, idr: p.idr * amt, php: p.php * amt, change24h: p.change24h ?? null, source: p.source, at: p.at })) };
}

export async function dashRecap(pid: string, days = 7) {
  const { today } = await todayFor(pid);
  const from = addDays(today, -Math.min(Math.max(days, 1), 60));
  const [comps, diary, tasks, projects] = await Promise.all([
    db().select().from(schema.taskCompletions).where(and(eq(schema.taskCompletions.profileId, pid), gte(schema.taskCompletions.day, from))),
    db().select().from(schema.diaryEntries).where(and(eq(schema.diaryEntries.profileId, pid), gte(schema.diaryEntries.day, from))),
    db().select({ id: schema.tasks.id, title: schema.tasks.title }).from(schema.tasks).where(eq(schema.tasks.profileId, pid)),
    projectsOf(pid),
  ]);
  const title = new Map(tasks.map((t) => [t.id, t.title]));
  const upcoming = projects.filter((p) => !["done", "dropped"].includes(p.status)).flatMap((p) => projectDates(p)).map((d) => ({ project: d.projectName, label: d.label, day: d.day, time: d.time ?? null, inDays: diffDays(d.day, today) })).filter((d) => d.inDays >= 0 && d.inDays <= 30).sort((a, b) => a.inDays - b.inDays);
  return {
    today, from,
    tasksDone: comps.length,
    byDay: Object.entries(comps.reduce<Record<string, string[]>>((m, c) => { (m[c.day] ??= []).push(title.get(c.taskId) ?? "task"); return m; }, {})).sort().reverse().slice(0, 14),
    diary: diary.map((d) => ({ day: d.day, title: d.title, text: plain(d.content, 200) })).slice(0, 20),
    projectsAdded: projects.filter((p) => dayIn(new Date(p.createdAt)) >= from).map((p) => p.name),
    calendar: upcoming.slice(0, 40),
  };
}

/** Untracked names from the news wire and OpenSea drops (for "suggest new projects"). */
export async function dashUntracked(pid: string) {
  const tracked = new Set((await projectsOf(pid)).map((p) => p.name.toLowerCase()));
  const news = (await getNews(false)).items.filter((i) => i.category !== "news").slice(0, 60).map((i) => ({ title: i.title, category: i.category, source: i.source, url: i.url, at: i.publishedAt }));
  const drops = openseaConfigured() ? (await listDropsRich(50).catch(() => [])).filter((d) => !tracked.has((d.collection_name ?? d.collection_slug).toLowerCase())).slice(0, 25).map((d) => ({ name: d.collection_name ?? d.collection_slug, chain: d.chain, minting: d.is_minting, start: (d.active_stage ?? d.next_stage)?.start_time ?? null, url: d.opensea_url })) : [];
  return { trackedCount: tracked.size, trackedNames: [...tracked].slice(0, 150), airdropTestnetNftDegenHeadlines: news, untrackedDrops: drops };
}
