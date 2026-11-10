import "server-only";
import { and, eq, gte, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { toCsv } from "@/lib/csv";
import { addDays, diffDays } from "@/lib/dates";
import { money, type Fiat } from "@/lib/fiat";
import { isProfileId } from "@/lib/profiles";
import { pnlFor } from "@/lib/project-utils";
import { isDue, isSatisfied } from "@/lib/streak";
import { earningsWithValue } from "./earnings";
import { getPrices } from "./prices";
import { getProfileInfo } from "./settings";
import { dayIn } from "./tz";
import { getCachedTrack } from "./wallet-track";

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export type MonthlyReport = Awaited<ReturnType<typeof buildMonthlyReport>>;

/** Everything for one profile and one calendar month (in the profile's zone). Pure read. */
export async function buildMonthlyReport(pid: string, month: string) {
  if (!isProfileId(pid)) throw new Error("unknown profile");
  const info = await getProfileInfo(pid);
  const today = dayIn(new Date(), info.tz);
  const start = `${month}-01`;
  const end = addDays(addDays(start, 32).slice(0, 8) + "01", -1); // last day of the month
  const until = diffDays(end, today) > 0 ? today : end; // don't count future days as missed
  const d = db();
  const [projects, positions, tasks, comps, earnings, watch, track] = await Promise.all([
    d.select().from(schema.projects).where(eq(schema.projects.profileId, pid)),
    d.select().from(schema.positions).where(eq(schema.positions.profileId, pid)),
    d.select().from(schema.tasks).where(eq(schema.tasks.profileId, pid)),
    d.select().from(schema.taskCompletions).where(and(eq(schema.taskCompletions.profileId, pid), gte(schema.taskCompletions.day, addDays(start, -7)), lte(schema.taskCompletions.day, end))),
    earningsWithValue(pid),
    d.select().from(schema.watchlist).where(eq(schema.watchlist.profileId, pid)),
    getCachedTrack(pid).catch(() => null),
  ]);
  const px = await getPrices(["tether", ...watch.map((w) => w.coinId)]).catch(() => ({}) as Awaited<ReturnType<typeof getPrices>>);
  const t = px.tether;
  const fiat: Fiat = info.fiat;
  const usdTo = fiat === "usd" ? 1 : t ? (fiat === "usdt" ? 1 / t.usdt : t[fiat] / t.usd) : null;
  const pname = new Map(projects.map((p) => [p.id, p.name]));

  const monthEarnings = earnings.filter((e) => e.claimedAt >= start && e.claimedAt <= end);
  const allByProject = new Map<string, { claim: number; now: number }>();
  for (const e of earnings) {
    const c = allByProject.get(e.projectId) ?? { claim: 0, now: 0 };
    c.claim += e.valueAtClaim ?? 0;
    c.now += e.currentUsd ?? e.valueAtClaim ?? 0;
    allByProject.set(e.projectId, c);
  }
  const portfolio = projects
    .filter((p) => p.status !== "dropped" || allByProject.has(p.id))
    .map((p) => {
      const r = pnlFor(p, positions);
      const e = allByProject.get(p.id);
      return { project: p.name, category: p.category, status: p.status, invested: r.invested, realized: r.realized, unrealized: r.unrealized, net: r.net, roi: r.roi, earnedAtClaim: e?.claim ?? 0, earnedNow: e?.now ?? 0 };
    })
    .sort((a, b) => b.earnedNow - a.earnedNow || b.net - a.net);

  const byTask = new Map<string, Set<string>>();
  for (const c of comps) (byTask.get(c.taskId) ?? byTask.set(c.taskId, new Set()).get(c.taskId)!).add(c.day);
  const taskRows = tasks
    .filter((tk) => diffDays(tk.startDate, end) <= 0)
    .map((tk) => {
      const like = { ...tk, weekdays: tk.weekdays ?? [] };
      const done = byTask.get(tk.id) ?? new Set<string>();
      let due = 0, hit = 0;
      const weeklyAny = tk.cadence === "weekly" && like.weekdays.length === 0;
      for (let day = start; diffDays(day, until) <= 0; day = addDays(day, 1)) {
        if (!isDue(like, day)) continue;
        if (weeklyAny && new Date(day + "T00:00:00Z").getUTCDay() !== 1 && day !== start) continue; // count each week once
        due++;
        if (isSatisfied(like, day, done)) hit++;
      }
      const completions = [...done].filter((x) => x >= start && x <= end).length;
      return { task: tk.title, project: tk.projectId ? pname.get(tk.projectId) ?? "" : "", cadence: tk.cadence, active: tk.active, due, done: hit, completions, rate: due ? hit / due : null };
    });

  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  return {
    profile: { id: pid, name: info.name, tz: info.tz, fiat },
    month,
    range: { start, end, until },
    generatedAt: new Date().toISOString(),
    fx: { usdTo, fiat },
    totals: {
      walletsUsd: track?.totalUsd ?? null,
      walletsAt: track?.fetchedAt ?? null,
      invested: sum(portfolio.map((p) => p.invested)),
      realized: sum(portfolio.map((p) => p.realized)),
      net: sum(portfolio.map((p) => p.net)),
      earnedMonthAtClaim: sum(monthEarnings.map((e) => e.valueAtClaim ?? 0)),
      earnedMonthNow: sum(monthEarnings.map((e) => e.currentUsd ?? e.valueAtClaim ?? 0)),
      earnedAllNow: sum([...allByProject.values()].map((v) => v.now)),
      tasksDue: sum(taskRows.map((r) => r.due)),
      tasksDone: sum(taskRows.map((r) => r.done)),
    },
    wallets: (track?.wallets ?? []).map((w) => ({ label: (w as { label?: string }).label ?? "", address: (w as { address: string }).address, usd: (w as { totalUsd?: number }).totalUsd ?? null })),
    portfolio,
    earnings: monthEarnings.map((e) => ({ date: e.claimedAt, project: pname.get(e.projectId) ?? "", symbol: e.symbol, amount: e.amount, valueAtClaimUsd: e.valueAtClaim, currentUsd: e.currentUsd, wallet: e.wallet ?? "", note: e.note ?? "" })),
    tasks: taskRows,
    watchlist: watch.map((w) => ({ symbol: w.symbol, name: w.name, usd: px[w.coinId]?.usd ?? null, change24h: px[w.coinId]?.change24h ?? null })),
  };
}

/** One CSV with a block per section (blank line between), easy to open in Sheets/Excel. */
export function reportCsv(r: MonthlyReport) {
  const fx = (usd: number | null | undefined) => (usd == null || r.fx.usdTo == null ? "" : money(usd * r.fx.usdTo, r.fx.fiat));
  const blocks: string[] = [];
  blocks.push(toCsv([{ report: `farmOS monthly report ${r.month}`, profile: r.profile.name, timezone: r.profile.tz, generated: r.generatedAt, currency: r.fx.fiat.toUpperCase(), usd_rate: r.fx.usdTo ?? "" }]));
  blocks.push(toCsv([
    { metric: "Wallet balances (USD)", value: r.totals.walletsUsd ?? "", local: fx(r.totals.walletsUsd) },
    { metric: "Invested (USD)", value: r.totals.invested, local: fx(r.totals.invested) },
    { metric: "Realized (USD)", value: r.totals.realized, local: fx(r.totals.realized) },
    { metric: "Net PnL (USD)", value: r.totals.net, local: fx(r.totals.net) },
    { metric: `Earned in ${r.month} at claim (USD)`, value: r.totals.earnedMonthAtClaim, local: fx(r.totals.earnedMonthAtClaim) },
    { metric: `Earned in ${r.month} now (USD)`, value: r.totals.earnedMonthNow, local: fx(r.totals.earnedMonthNow) },
    { metric: "Tasks done / due", value: `${r.totals.tasksDone}/${r.totals.tasksDue}`, local: "" },
  ], ["metric", "value", "local"]));
  blocks.push("Portfolio\r\n" + toCsv(r.portfolio, ["project", "category", "status", "invested", "realized", "unrealized", "net", "roi", "earnedAtClaim", "earnedNow"]));
  blocks.push("Earnings this month\r\n" + toCsv(r.earnings, ["date", "project", "symbol", "amount", "valueAtClaimUsd", "currentUsd", "wallet", "note"]));
  blocks.push("Tasks\r\n" + toCsv(r.tasks, ["task", "project", "cadence", "active", "due", "done", "completions", "rate"]));
  if (r.wallets.length) blocks.push("Wallets\r\n" + toCsv(r.wallets, ["label", "address", "usd"]));
  if (r.watchlist.length) blocks.push("Watchlist\r\n" + toCsv(r.watchlist, ["symbol", "name", "usd", "change24h"]));
  return blocks.join("\r\n");
}
