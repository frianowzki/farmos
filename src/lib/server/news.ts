import "server-only";
import { getSetting, setSetting } from "./settings";
import { GLOBAL_PROFILE } from "@/lib/profiles";

/**
 * News wire: free public RSS/Atom feeds from crypto newsrooms and airdrop trackers. No keys.
 * CryptoRank, CryptoSlate and CoinGecko news sit behind Cloudflare bot checks and DefiLlama's raises
 * API is paid, so they are not polled.
 */
export type NewsSource = { id: string; name: string; url: string; site: string; kind: "newsroom" | "research" | "ecosystem" | "airdrop"; category?: "airdrop" | "news" };
// Every feed below answered with items from a plain server fetch (Nov 2026). Dropped: CryptoSlate and
// CryptoRank (403 bot wall), CryptoPanic RSS (410; its free API needs a key), Messari and Uniswap (no feed).
export const NEWS_SOURCES: NewsSource[] = [
  { id: "coindesk", name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/", site: "coindesk.com", kind: "newsroom" },
  { id: "theblock", name: "The Block", url: "https://www.theblock.co/rss.xml", site: "theblock.co", kind: "newsroom" },
  { id: "decrypt", name: "Decrypt", url: "https://decrypt.co/feed", site: "decrypt.co", kind: "newsroom" },
  { id: "cointelegraph", name: "Cointelegraph", url: "https://cointelegraph.com/rss", site: "cointelegraph.com", kind: "newsroom" },
  { id: "blockworks", name: "Blockworks", url: "https://blockworks.co/feed", site: "blockworks.co", kind: "newsroom" },
  { id: "dlnews", name: "DL News", url: "https://www.dlnews.com/arc/outboundfeeds/rss/", site: "dlnews.com", kind: "newsroom" },
  { id: "defiant", name: "The Defiant", url: "https://thedefiant.io/api/feed", site: "thedefiant.io", kind: "newsroom" },
  { id: "unchained", name: "Unchained", url: "https://unchainedcrypto.com/feed/", site: "unchainedcrypto.com", kind: "newsroom" },
  { id: "protos", name: "Protos", url: "https://protos.com/feed/", site: "protos.com", kind: "newsroom" },
  { id: "cryptobriefing", name: "Crypto Briefing", url: "https://cryptobriefing.com/feed/", site: "cryptobriefing.com", kind: "newsroom" },
  { id: "beincrypto", name: "BeInCrypto", url: "https://beincrypto.com/feed/", site: "beincrypto.com", kind: "newsroom" },
  { id: "cryptopotato", name: "CryptoPotato", url: "https://cryptopotato.com/feed/", site: "cryptopotato.com", kind: "newsroom" },
  { id: "dailyhodl", name: "The Daily Hodl", url: "https://dailyhodl.com/feed/", site: "dailyhodl.com", kind: "newsroom" },
  { id: "cryptonews", name: "Cryptonews", url: "https://cryptonews.com/news/feed/", site: "cryptonews.com", kind: "newsroom" },
  { id: "utoday", name: "U.Today", url: "https://u.today/rss", site: "u.today", kind: "newsroom" },
  { id: "bitcoincom", name: "Bitcoin.com News", url: "https://news.bitcoin.com/feed/", site: "news.bitcoin.com", kind: "newsroom" },
  { id: "bitcoinmagazine", name: "Bitcoin Magazine", url: "https://bitcoinmagazine.com/feed", site: "bitcoinmagazine.com", kind: "newsroom" },
  { id: "bankless", name: "Bankless", url: "https://www.bankless.com/rss/feed", site: "bankless.com", kind: "research" },
  { id: "a16zcrypto", name: "a16z crypto", url: "https://a16zcrypto.com/feed/", site: "a16zcrypto.com", kind: "research" },
  { id: "ethereum", name: "Ethereum Foundation", url: "https://blog.ethereum.org/feed.xml", site: "blog.ethereum.org", kind: "ecosystem" },
  { id: "base", name: "Base blog", url: "https://paragraph.com/@blog.base.org/rss", site: "base.org", kind: "ecosystem" },
  { id: "optimism", name: "Optimism", url: "https://optimism.mirror.xyz/feed/atom", site: "optimism.io", kind: "ecosystem" },
  { id: "offchainlabs", name: "Offchain Labs (Arbitrum)", url: "https://medium.com/feed/offchainlabs", site: "arbitrum.io", kind: "ecosystem" },
  { id: "hyperliquid", name: "Hyperliquid", url: "https://hyperliquid.medium.com/feed", site: "hyperliquid.xyz", kind: "ecosystem" },
  { id: "sui", name: "Sui blog", url: "https://blog.sui.io/rss/", site: "sui.io", kind: "ecosystem" },
  { id: "airdropsio", name: "Airdrops.io", url: "https://airdrops.io/feed/", site: "airdrops.io", kind: "airdrop", category: "airdrop" },
  { id: "airdropalert", name: "Airdrop Alert", url: "https://airdropalert.com/feed/", site: "airdropalert.com", kind: "airdrop" },
];

export type NewsItem = { id: string; title: string; url: string; source: string; sourceId: string; site: string; kind?: NewsSource["kind"]; publishedAt: string | null; summary: string; image: string | null; category: "airdrop" | "testnet" | "nft" | "degen" | "news" };
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
  return blocks.slice(0, 20).flatMap((b) => {
    const title = strip(tag(b, "title"));
    const url = (atom ? attr(b, "link", "href") : strip(tag(b, "link"))) || strip(tag(b, "guid"));
    if (!title || !/^https?:\/\//.test(url)) return [];
    const raw = tag(b, "description") || tag(b, "summary") || tag(b, "content:encoded") || tag(b, "content");
    const summary = strip(raw).slice(0, 700);
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
      kind: src.kind,
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
  // Some blogs (Ethereum Foundation) ship their whole archive; the newest items are at the top.
  return parse((await r.text()).slice(0, 1_500_000), src);
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
  return { fetchedAt: new Date().toISOString(), items: items.slice(0, 400), failed };
}

export async function getNews(force = false): Promise<NewsSnapshot & { cached: boolean }> {
  const c = await getSetting<NewsSnapshot>(GLOBAL_PROFILE, "news_wire");
  if (!force && c?.fetchedAt && Date.now() - +new Date(c.fetchedAt) < TTL_MS) return { ...c, cached: true };
  const snap = await fetchNews();
  if (snap.items.length) await setSetting(GLOBAL_PROFILE, "news_wire", snap);
  return { ...snap, cached: false };
}
