import "server-only";
import { and, eq } from "drizzle-orm";
import { isAddress } from "viem";
import { db, schema } from "@/db";
import type { AirdropChecker } from "@/db/schema";
import { money, type Fiat } from "@/lib/fiat";
import { shortAddr } from "@/lib/format";
import { runChecker } from "./airdrop-check";
import { getPrices } from "./prices";
import { guardedFetch } from "./ssrf";
import { esc, getNotify, sendTelegram } from "./telegram";

const appLink = (path: string) => (process.env.APP_URL ? `\n<a href="${esc(process.env.APP_URL.replace(/\/$/, "") + path)}">Open in farmOS</a>` : "");

async function notifier(pid: string, kind: "claims" | "prices") {
  const n = await getNotify(pid);
  const can = Boolean(n.chatId && n[kind] && process.env.TELEGRAM_BOT_TOKEN);
  return { can, send: async (html: string) => (can ? (await sendTelegram(n.chatId!, html), true) : false) };
}

/** Is a claim page live? 2xx and (if set) the match text is on the page. Read-only GET, SSRF-guarded. */
export async function pageIsLive(url: string, match?: string): Promise<{ live: boolean; detail: string }> {
  const u = new URL(url);
  if (u.protocol !== "https:") return { live: false, detail: "Only https URLs" };
  const res = await guardedFetch(u.toString(), { headers: { accept: "text/html,application/json;q=0.9,*/*;q=0.5", "user-agent": "Mozilla/5.0 farmOS claim watch" }, cache: "no-store", signal: AbortSignal.timeout(12_000) }, 3);
  if (!res.ok) return { live: false, detail: `HTTP ${res.status}` };
  if (!match?.trim()) return { live: true, detail: `HTTP ${res.status}` };
  const text = (await res.text()).slice(0, 3_000_000).toLowerCase();
  const hit = text.includes(match.trim().toLowerCase());
  return { live: hit, detail: hit ? `Found “${match.trim()}”` : `“${match.trim()}” not on page yet` };
}

/**
 * Runs every auto-check claim watch of a profile and sends one Telegram message per new event:
 * a claim page going live, or a wallet becoming eligible. Never signs or sends transactions.
 */
export async function checkClaims(pid: string, only?: { projectId: string }) {
  const d = db();
  const base = d.select().from(schema.projects);
  const all = await (only ? base.where(and(eq(schema.projects.profileId, pid), eq(schema.projects.id, only.projectId))) : base.where(eq(schema.projects.profileId, pid)));
  // "Check now" on one project ignores the auto-check switch and project status.
  const projects = only ? all.filter((p) => p.checker) : all.filter((p) => p.checker && p.checker.autoCheck !== false && !["done", "dropped"].includes(p.status) && p.checker.claimStatus !== "claimed" && p.checker.claimStatus !== "closed");
  if (!projects.length) return { checked: 0, alerts: 0 };
  const tg = await notifier(pid, "claims");
  const allWallets = (await d.select({ address: schema.wallets.address }).from(schema.wallets).where(eq(schema.wallets.profileId, pid))).map((w) => w.address).filter((a) => isAddress(a));
  let alerts = 0;
  for (const p of projects) {
    const c = p.checker as AirdropChecker;
    const next: AirdropChecker = { ...c, alerts: { ...(c.alerts ?? {}) } };
    let eligibility = p.eligibility;
    const msgs: string[] = [];
    try {
      if (c.type === "page" && c.url) {
        const r = await pageIsLive(c.url, c.match);
        next.lastRun = { at: new Date().toISOString(), results: [{ wallet: "page", status: r.live ? "eligible" : "not_eligible", detail: r.detail }] };
        if (r.live && !c.alerts?.openAt) {
          next.alerts!.openAt = new Date().toISOString();
          msgs.push(`🟢 <b>${esc(p.name)}</b>: claim page is live\n${esc(c.url)}`);
        }
        if (!r.live && c.alerts?.openAt) next.alerts!.openAt = null; // re-arm if the page goes away again
      } else if (c.type === "api" || c.type === "contract" || c.type === "merkle") {
        let wallets = p.wallets.filter((w) => isAddress(w));
        if (!wallets.length) wallets = allWallets;
        if (!wallets.length) {
          if (only) throw new Error("Link an EVM wallet first");
          continue;
        }
        const results = await runChecker(c, wallets);
        next.lastRun = { at: new Date().toISOString(), results };
        const known = new Set((c.alerts?.eligible ?? []).map((w) => w.toLowerCase()));
        const fresh = results.filter((r) => r.status === "eligible" && !known.has(r.wallet.toLowerCase()));
        next.alerts!.eligible = [...new Set([...(c.alerts?.eligible ?? []), ...results.filter((r) => r.status === "eligible").map((r) => r.wallet)])];
        if (fresh.length) {
          const lines = fresh.map((r) => `• <code>${esc(shortAddr(r.wallet))}</code>${r.amount ? `: ${esc(r.amount)}` : ""}`);
          msgs.push(`🎯 <b>${esc(p.name)}</b>: ${fresh.length} wallet${fresh.length > 1 ? "s" : ""} eligible\n${lines.join("\n")}${c.claimUrl ? `\nClaim: ${esc(c.claimUrl)}` : ""}`);
        }
        const ok = results.filter((r) => r.status !== "error");
        eligibility = ok.some((r) => r.status === "eligible") ? "eligible" : ok.length && ok.length === results.length ? "not_eligible" : p.eligibility;
      } else continue;
    } catch (e) {
      next.lastRun = { at: new Date().toISOString(), results: [{ wallet: "check", status: "error", detail: (e as Error).message.slice(0, 120) }] };
    }
    // Only remember alerts as sent when Telegram actually delivered them (so linking later still notifies).
    if (msgs.length) {
      const sent = await tg.send(msgs.join("\n\n") + appLink(`/projects/${p.id}`)).catch(() => false);
      if (sent) alerts += msgs.length;
      else next.alerts = c.alerts ?? null;
    }
    await d.update(schema.projects).set({ checker: next, eligibility }).where(and(eq(schema.projects.profileId, pid), eq(schema.projects.id, p.id)));
  }
  return { checked: projects.length, alerts };
}

/**
 * Evaluates above/below alerts on the profile's watchlist. Each alert fires once, then re-arms when the
 * price moves back past the threshold by 1%.
 */
export async function checkWatchlist(pid: string) {
  const d = db();
  const rows = await d.select().from(schema.watchlist).where(eq(schema.watchlist.profileId, pid));
  const armed = rows.filter((r) => r.above != null || r.below != null);
  if (!armed.length) return { checked: 0, alerts: 0 };
  const prices = await getPrices(armed.map((r) => r.coinId), { force: true });
  const tg = await notifier(pid, "prices");
  const msgs: string[] = [];
  const updates: { id: string; state: { above?: string | null; below?: string | null } }[] = [];
  for (const r of armed) {
    const q = prices[r.coinId];
    if (!q || q.stale) continue;
    const cur = r.alertCurrency as Fiat;
    const px = q[cur];
    if (!Number.isFinite(px)) continue;
    const st = { ...(r.alertState ?? {}) };
    let changed = false;
    if (r.above != null) {
      if (px >= r.above && !st.above) { msgs.push(`📈 <b>${esc(r.symbol || r.coinId)}</b> is ${esc(money(px, cur))}, above your ${esc(money(r.above, cur))} alert`); st.above = new Date().toISOString(); changed = true; }
      else if (px < r.above * 0.99 && st.above) { st.above = null; changed = true; }
    }
    if (r.below != null) {
      if (px <= r.below && !st.below) { msgs.push(`📉 <b>${esc(r.symbol || r.coinId)}</b> is ${esc(money(px, cur))}, below your ${esc(money(r.below, cur))} alert`); st.below = new Date().toISOString(); changed = true; }
      else if (px > r.below * 1.01 && st.below) { st.below = null; changed = true; }
    }
    if (changed) updates.push({ id: r.id, state: st });
  }
  let sent = false;
  if (msgs.length) sent = await tg.send(`<b>farmOS price alerts</b>\n\n${msgs.join("\n")}` + appLink("/prices")).catch(() => false);
  // Fired flags only stick when delivered; re-arm flags always apply.
  for (const u of updates) {
    const row = armed.find((r) => r.id === u.id)!;
    const keep = (k: "above" | "below") => (u.state[k] == null ? null : row.alertState?.[k] ?? null);
    const state = sent ? u.state : { above: keep("above"), below: keep("below") };
    await d.update(schema.watchlist).set({ alertState: state }).where(and(eq(schema.watchlist.profileId, pid), eq(schema.watchlist.id, u.id)));
  }
  return { checked: armed.length, alerts: sent ? msgs.length : 0, pending: sent ? 0 : msgs.length, telegram: tg.can };
}
