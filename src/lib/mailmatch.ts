export type MailLike = { from: string; subject: string; snippet: string };
export type ProjectMatchLike = { id: string; name: string; links?: Record<string, string | undefined>; mailMatchers?: string[] };

export const MAIL_SIGNALS = [
  { id: "whitelist", label: "Whitelist", re: /\b(whitelist(ed)?|allow ?list(ed)?|\bWL\b|GTD|FCFS|you('| a)re in|selected|winner|won)\b/i },
  { id: "kyc", label: "KYC", re: /\b(kyc|identity verification|verify your identity|proof of personhood)\b/i },
  { id: "claim", label: "Claim", re: /\b(claim|eligible|eligibility|airdrop (is )?live|distribution|unlock|tge)\b/i },
  { id: "mint", label: "Mint", re: /\b(mint(ing)?|presale|public sale)\b/i },
  { id: "testnet", label: "Testnet", re: /\b(testnet|faucet|devnet|incentivi[sz]ed)\b/i },
  { id: "security", label: "Security", re: /\b(new (sign[- ]?in|login)|password reset|2fa|security alert)\b/i },
] as const;

export function classifyMail(m: MailLike): string[] {
  const text = `${m.subject} ${m.snippet}`;
  return MAIL_SIGNALS.filter((s) => s.re.test(text)).map((s) => s.id);
}

export function senderDomain(from: string): string {
  const email = from.match(/<([^>]+)>/)?.[1] ?? from;
  const at = email.lastIndexOf("@");
  return at >= 0 ? email.slice(at + 1).trim().toLowerCase().replace(/>$/, "") : "";
}

function rootDomain(host: string) {
  const parts = host.toLowerCase().replace(/^www\./, "").split(".");
  return parts.slice(-2).join(".");
}

function hostOf(url?: string) {
  if (!url) return "";
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
  } catch {
    return "";
  }
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Returns project ids that this email most likely belongs to. */
export function matchMail(m: MailLike, projects: ProjectMatchLike[]): string[] {
  const dom = senderDomain(m.from);
  const droot = dom ? rootDomain(dom) : "";
  const text = `${m.from} ${m.subject} ${m.snippet}`;
  const out: string[] = [];
  for (const p of projects) {
    let hit = false;
    for (const url of Object.values(p.links ?? {})) {
      const h = hostOf(url);
      if (!h || /(^|\.)(x|twitter|discord|t|telegram|github|medium|galxe|zealy|gitbook)\.(com|gg|me|io)$/.test(h)) continue;
      if (droot && rootDomain(h) === droot) hit = true;
    }
    for (const raw of p.mailMatchers ?? []) {
      const k = raw.trim().toLowerCase();
      if (!k) continue;
      if (k.includes(".") && !k.includes(" ")) {
        if (dom === k || dom.endsWith(`.${k}`) || droot === rootDomain(k)) hit = true;
      } else if (new RegExp(`\\b${escapeRe(k)}\\b`, "i").test(text)) hit = true;
    }
    if (!hit && p.name.trim().length >= 3 && new RegExp(`\\b${escapeRe(p.name.trim())}\\b`, "i").test(`${m.from} ${m.subject}`)) hit = true;
    if (hit) out.push(p.id);
  }
  return out;
}
