import "server-only";
import { getSetting, setSetting } from "./settings";

/**
 * News wire: free public RSS/Atom feeds from crypto newsrooms and airdrop trackers. No keys.
 * CryptoRank, CryptoSlate and CoinGecko news sit behind Cloudflare bot checks and DefiLlama's raises
 * API is paid, so they are not polled.
 */
export type NewsSource = { id: string; name: string; url: string; site: string; category?: "airdrop" | "news" };
export const NEWS_SOURCES: NewsSource[] = [
  { id: "coindesk", name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/", site: "coindesk.com" },
  { id: "theblock", name: "The Block", url: "https://www.theblock.co/rss.xml", site: "theblock.co" },
  { id: "decrypt", name: "Decrypt", url: "https://decrypt.co/feed", site: "decrypt.co" },
  { id: "cointelegraph", name: "Cointelegraph", url: "https://cointelegraph.com/rss", site: "cointelegraph.com" },
  { id: "defiant", name: "The Defiant", url: "https://thedefiant.io/api/feed", site: "thedefiant.io" },
  { id: "blockworks", name: "Blockworks", url: "https://blockworks.co/feed", site: "blockworks.co" },
  { id: "bankless", name: "Bankless", url: "https://www.bankless.com/rss/feed", site: "bankless.com" },
  { id: "dlnews", name: "DL News", url: "https://www.dlnews.com/arc/outboundfeeds/rss/", site: "dlnews.com" },
  { id: "cryptonews", name: "Cryptonews", url: "https://cryptonews.com/news/feed/", site: "cryptonews.com" },
  { id: "bitcoinmagazine", name: "Bitcoin Magazine", url: "https://bitcoinmagazine.com/feed", site: "bitcoinmagazine.com" },
  { id: "airdropsio", name: "Airdrops.io", url: "https://airdrops.io/feed/", site: "airdrops.io", category: "airdrop" },
  { id: "airdropalert", name: "Airdrop Alert", url: "https://airdropalert.com/feed/", site: "airdropalert.com" },
];

export type NewsItem = { id: string; title: string; url: string; source: string; sourceId: string; site: string; publishedAt: string | null; summary: string; image: string | null; category: "airdrop" | "testnet" | "nft" | "degen" | "news" };
export type NewsSnapshot = { fetchedAt: string; items: NewsItem[]; failed: string[] };

const TTL_MS = 15 * 60_000;

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp|#039);/g, (m) => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'", "&nbsp;": " ", "&#039;": "'" })[m] ?? m);
const strip = (s: string) => decode(decode(s).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"))?.[1] ?? "";
const attr = (xml: string, name: string, a: string) => xml.match(new RegExp(`<${name}\\b[^>]*\\b${a}="([^"]+)"`, "i"))?.[1] ?? null;

/** Keyword categories, so the Airdrop / Testnet / NFT / Degen chips work on the wire too. */
function categorize(title: string, summary: string, fallback?: NewsItem["category"]): NewsItem["category"] {
  const t = `${title} ${summary}`.toLowerCase();
  if (/\bairdrop|points program|retroactive|claim(ing)? (window|portal)|\bsnapshot\b|\btge\b/.test(t)) return "airdrop";
  if (/\btestnet|devnet|incentivi[sz]ed/.test(t)) return "testnet";
  if (/\bnfts?\b|\bmint(ing)?\b|opensea|ordinals|collectible/.test(t)) return "nft";
  if (/memecoin|meme coin|\bpump\.fun|\bdegen|leverage|liquidat|perp(s|etual)|\b\d+x\b/.test(t)) return "degen";
  return fallback ?? "news";
}

function parse(xml: string, src: NewsSource): NewsItem[] {
  const atom = /<feed[\s>]/i.test(xml.slice(0, 500));
  const blocks = xml.match(atom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  return blocks.slice(0, 25).flatMap((b) => {
    const title = strip(tag(b, "title"));
    const url = (atom ? attr(b, "link", "href") : strip(tag(b, "link"))) || strip(tag(b, "guid"));
    if (!title || !/^https?:\/\//.test(url)) return [];
    const raw = tag(b, "description") || tag(b, "summary") || tag(b, "content:encoded") || tag(b, "content");
    const summary = strip(raw).slice(0, 280);
    const date = strip(tag(b, "pubDate") || tag(b, "published") || tag(b, "updated") || tag(b, "dc:date"));
    const d = date ? new Date(date) : null;
    const image = attr(b, "media:content", "url") ?? attr(b, "media:thumbnail", "url") ?? attr(b, "enclosure", "url") ?? decode(raw).match(/<img[^>]+src="([^"]+)"/i)?.[1] ?? null;
    return [{
      id: `${src.id}:${url}`,
      title,
      url,
      source: src.name,
      sourceId: src.id,
      site: src.site,
      publishedAt: d && !Number.isNaN(+d) ? d.toISOString() : null,
      summary,
      image: image && /^https?:\/\//.test(image) ? decode(image) : null,
      category: categorize(title, summary, src.category),
    }];
  });
}

async function fetchSource(src: NewsSource): Promise<NewsItem[]> {
  const r = await fetch(src.url, { headers: { "user-agent": "Mozilla/5.0 (compatible; farmOS/1.0; +https://farmos-os.vercel.app)", accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" }, cache: "no-store", signal: AbortSignal.timeout(9000) });
  if (!r.ok) throw new Error(String(r.status));
  return parse(await r.text(), src);
}

export async function fetchNews(): Promise<NewsSnapshot> {
  const failed: string[] = [];
  const lists = await Promise.all(NEWS_SOURCES.map((s) => fetchSource(s).catch(() => { failed.push(s.name); return [] as NewsItem[]; })));
  const seen = new Set<string>();
  const items = lists.flat().filter((i) => {
    const k = i.title.toLowerCase().replace(/\W+/g, " ").trim();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  items.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  return { fetchedAt: new Date().toISOString(), items: items.slice(0, 240), failed };
}

export async function getNews(force = false): Promise<NewsSnapshot & { cached: boolean }> {
  const c = await getSetting<NewsSnapshot>("news_wire");
  if (!force && c?.fetchedAt && Date.now() - +new Date(c.fetchedAt) < TTL_MS) return { ...c, cached: true };
  const snap = await fetchNews();
  if (snap.items.length) await setSetting("news_wire", snap);
  return { ...snap, cached: false };
}
