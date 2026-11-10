# Changelog

All notable changes to **farmOS** are documented here.

FarmOS is a private crypto farming workspace: projects, tasks, diary, wallets,
airdrops, mints, research desk — read-only by design.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- **Third profile** — `Rizka (p3)` as a fully separate workspace
- **Default wallet** — hero card with per-chain balances and default switcher
- **NEAR** chain — named/implicit accounts, NEAR + USDC/USDT balances over public NEAR RPC (FastNEAR with near.org fallback), official logo
- **Canton Network** — party ids saved watch-only (Scan API is validator-only) with ccscan explorer link
- **Arc (Circle) mainnet** — chain id `5042` via `rpc.mainnet.arc.io`, native USDC balance reads
- **Project summary auto-fill from X bio** — fetch button, auto-fill on create and when links are set; fallback chain `X API → fxtwitter → vxtwitter → website og:description`
- **Gas & capital ledger** — per-project `costs` table (profile-scoped) with live vs entry value and ROI, surfaced on Portfolio and KPI
- **Convert** — replaced Prices page; 11 default coins, rest via search, token logos, USD default
- **News wire** — 27 sources, search, source/kind filters, unread/saved, "why it matters", reading list, mark read, favicons, expandable summaries
- **Monthly report** — CSV export and printable `/report` page
- **Second cron** — `/api/cron/alerts` at 12:00 UTC (daily cron also runs claim + price checks)
- **Key dates** — optional time (12h), used in countdowns, calendar sync and alerts
- **Project links** — custom names
- **Accent presets** — time-of-day, daily and custom accents; all presets meet WCAG 4.5:1, custom accents auto-adjust per mode
- **Desktop polish** — project logos in task rows and desk pickers (including the research desk project selector)
- **Tests** — `tests/accent.test.ts` for contrast compliance

### Changed
- **Wallet stacking** — default wallet listed first, badged, preselected in earnings / gas / capital, checked first for claim and mint eligibility, known to the research desk
- **NEAR wallet kit** — `@near-wallet-selector`: Meteor, HOT, MyNearWallet, Nightly, Sender, Intear
- **Canton wallet kit** — `@canton-network/dapp-sdk`: Console, Loop, CIP-0103
- **Monero** — watch-only
- **Mobile in-app browser links** for Phantom, Solflare, OKX
- **Brand** — new vector-traced farmOS logo (light + dark variants), sprout favicon / PWA / apple / maskable icons, service worker cache `v4`
- **Desk empty state** — uses the sprout icon, updated composer placeholder
- **Upcoming mints** — removed the `All` tab (`Minting` is default)
- **Wallets list** — default row fits within 390px; filled star marks it on mobile; default wallet jumps to the top with optimistic reorder + layout animation
- **Research desk** — read-only, profile-scoped dashboard tools with status chips and new prompts
- **Mobile** — dropped the dock in favour of a header drawer + quick add, safe areas, no double-tap zoom, 16px inputs, tighter masked keys table
- **Recap** — removed the 3D day-card timeline
- **Settings** — masked API keys, cleaner layout

### Fixed
- **Discord OAuth callback** — RFC 9207 `iss` validation
- **Link errors** — return to Settings instead of `/login`
- **Telegram** — deep-link linking and widget redirect flow
- **Converter** — no double focus ring inside amount fields
- **Mobile Today** — side column stays within viewport width
- **Chromatic reveal** — colour correction

### Removed
- Prices page and watchlist UI
- `All` tab in Upcoming mints
- 3D day-card timeline in Recap
- Research desk disclaimer text
- Footer note on the login page
- `scripts/gen-pwa-icons.mjs` (replaced by `scripts/brand/3-icons.cjs`)

---

## [0.2.0] — 2026-11-10

The largest single day of development: multi-profile, multichain, and the full
airdrop/farming toolset.

### Added
- **Multiple profiles** — passcode picks the profile; every table and route scoped by `profile_id`
- **Per-profile time zone**
- **Multichain wallets** — Solana, Aptos, Sui, Zcash
- **NFT holdings** with floor price, eligibility checks
- **Telegram daily digest** — cron at 07:00 WIB, `CRON_SECRET`, chat linking, per-setting toggles, test send
- **Airdrop checker** per project — checker API, claim-contract view, or claims list (read-only)
- **Wallet auto-track** — Etherscan V2 + RPC balances, main tokens, on-chain degen PnL, 10-minute cache
- **Backup / export** — full JSON + per-table CSV, validated JSON restore, Blob snapshots (keep 7)
- **PWA** — manifest with PNG/maskable icons, offline-shell service worker, iOS meta tags
- **Notifications** — wallet tracking, claim alerts, price alerts
- **Earnings per project** — amount, value at claim, live value; Earned KPI on Today; earnings + best projects on Portfolio
- **Claim watch** — claim page goes live, checker API, contract view, Merkle list or manual status, claim badge on projects, Telegram alert on new events
- **Watchlist** — price, 24h change, above/below alerts in any currency
- **Per-task digest reminder** toggle (`tasks.remind`)
- **Tables** — `earnings`, `watchlist` (profile-scoped, additive migration with backup)
- **Integrations API** — `/api/integrations` exposes X, Discord, GitHub, Google, Telegram with env-set markers

### Changed
- **Chain logos** on project cards, lists and positions
- **Research desk redesign** — layout, dashboard awareness
- **Feed AI** and multi-wallet portfolio
- **Canonical domain redirect** to `farmos-os.vercel.app`

### Security
- Hardened `.gitignore` for env files, keys and secrets
- Tokens stored in keyring, never logged

---

## [0.1.0] — 2026-11-09

First usable build.

### Added
- **frioOS v1** — workspace shell, projects database, tasks, diary, wallets, Google integration, AI desk
- **Rebrand** to farmOS (user-visible) + web manifest
- **Recap** — streaks, heatmap, daily recap
- **Feed**
- **Upcoming mints** — OpenSea drops with on-chain whitelist checks on your wallets
- **Connected accounts** — X, Discord, GitHub, Telegram, Farcaster
- **Project fields** — rating, audit, accent, campaign, files
- **KPIs** on Today
- **Login and settings redesign**
- **Docs** — `SETUP.md`, `AGENTS.md`, screenshots
- **Design foundation** — shadcn base, soundcn UI sounds, Motion, design tokens

### Changed
- Production domain set to `frioos-iota.vercel.app`

---

## Deployment notes

- **Host:** Vercel — project `frioos`, framework Next.js, region `iad1`
- **Production branch:** `master`
- **Git integration:** enabled — every push to `master` deploys automatically
- **Cron jobs** (`vercel.json`):
  - `/api/cron/daily` → `0 0 * * *` (00:00 UTC / 07:00 WIB)
  - `/api/cron/alerts` → `0 12 * * *` (12:00 UTC / 19:00 WIB)
- **Database:** Neon Postgres (Drizzle ORM)
- **Blob storage:** Vercel Blob (`frioos-files`, keep 7 snapshots — Hobby limits)
- **Design principle:** read-only by design — no signing, no broadcasting, no custody
