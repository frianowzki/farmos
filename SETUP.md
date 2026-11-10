# farmOS setup

Production: **https://farmos-os.vercel.app** (canonical, `APP_URL`). The old alias https://frioos-iota.vercel.app redirects there (pages and `/api/auth/*`, see `src/proxy.ts`), so every OAuth provider only needs the farmos-os URLs. Vercel project `frioos`, team frianowzkis-projects.

## 0. Unlock
- The app is behind a passcode gate (`APP_PASSCODE`, kept in an httpOnly signed cookie for 30 days).
- The current passcode is stored on the Grok Bot box at `/home/box/secrets/frioos-passcode.txt`.
- To change it: Vercel → frioos → Settings → Environment Variables → edit `APP_PASSCODE` (Production + Preview), then redeploy. Changing `AUTH_SECRET` signs out all sessions.

## 1. Database (already done)
- Neon Postgres via the Vercel Marketplace, connected to the project. Vercel injects `DATABASE_URL` and the related vars.
- Schema: `src/db/schema.ts`. Apply changes with `npm run db:push` (needs `DATABASE_URL_UNPOOLED` locally: `vercel env pull .env.local`).

## 2. Google (Gmail read-only + Calendar sync)
Until these env vars exist, the Mail and Calendar sections show a setup card. No fake data is shown.

1. Go to https://console.cloud.google.com and create a project (for example "farmOS").
2. Under APIs & Services → Library, enable the **Gmail API** and the **Google Calendar API**.
3. Under APIs & Services → OAuth consent screen:
   - User type: External.
   - App name: farmOS, with your email as support/developer contact.
   - Scopes: add `.../auth/gmail.readonly` and `.../auth/calendar.events` (plus openid, email, profile).
   - Publishing status: leave it in **Testing** and add your own Gmail under **Audience → Test users**. Testing mode means no Google verification is needed. Refresh tokens in Testing mode expire after 7 days, so if mail stops loading, reconnect in Settings.
   - "Access blocked: … has not completed the Google verification process" means the Google account you signed in with is **not on the Test users list** (or the app was switched to *In production*, where `gmail.readonly` needs verification). Add the account as a test user and keep the app in Testing.
4. Under APIs & Services → Credentials → Create credentials → OAuth client ID:
   - Type: **Web application**.
   - Authorized JavaScript origin: `https://farmos-os.vercel.app`.
   - Authorized redirect URI: `https://farmos-os.vercel.app/api/auth/callback/google`.
   - For local dev, also add `http://localhost:3000` and `http://localhost:3000/api/auth/callback/google`.
5. In Vercel → frioos → Settings → Environment Variables (Production + Preview), add:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `ALLOWED_EMAIL`: the only Google account allowed to sign in, for example `you@gmail.com`.
6. Redeploy (Deployments → ⋯ → Redeploy, or `vercel --prod`).
7. In farmOS → Settings → Google, click **Connect Google**.

What it does:
- Mail lists recent messages (read-only scope) and matches them to projects by each project's "Mail matchers" (domains, senders, keywords).
- Calendar shows upcoming events and can push project deadlines and key dates as all-day events ("Sync to Calendar").
- OAuth tokens are stored AES-GCM-encrypted in the database and never reach the browser.
- Disconnect from Settings at any time. You can also revoke access at https://myaccount.google.com/permissions.

Google sign-in can also unlock the app instead of the passcode, but only for `ALLOWED_EMAIL`.

## 3. AI desk (OpenAI-compatible)
Works with any OpenAI-compatible endpoint: official DeepSeek, a custom DeepSeek-compatible gateway, or your own server. There are no hardcoded provider defaults; if these values are unset in both Settings and env, the AI desk stays unconfigured.

Option A, in the UI: Settings → AI, enter Base URL, API key, and Model, then **Test connection**. The key is encrypted server-side (with `AUTH_SECRET`). It is never returned to the browser; the UI only shows "key saved".

Option B, env vars (used as fallback when the Settings fields are empty; Settings wins if both are set):
- `AI_BASE_URL`: the provider base URL, including `/v1` if the provider uses it (example: `https://api.deepseek.com/v1`)
- `AI_API_KEY`: your provider API key
- `AI_MODEL`: the model id your provider expects (example for official DeepSeek: `deepseek-chat`; `deepseek-reasoner` also works there, but tool calling is best on `deepseek-chat`)

Optional: `ETHERSCAN_API_KEY` (Etherscan v2 multichain). It lets the Audit mode fetch verified source and scan it for red flags. Without it, audits use on-chain checks only: bytecode, proxy slots, and owner().

Modes:
- Research: a deep dive on a project.
- Audit: contract and risk review.
- Daily: a scan of what's moving today.
- Early: early-stage opportunities.

Tools are public read-only data: DefiLlama, DexScreener, GeckoTerminal, CoinGecko trending, URL fetch, on-chain contract check, and your own projects DB. The AI can *propose* a project; nothing is saved until you click Add. If your endpoint doesn't support tools, turn off "Use tools" in Settings → AI.

## 4. Wallets
- Injected wallets (MetaMask, Rabby, and others) work with no config.
- For WalletConnect (mobile wallets, QR), create a project at https://cloud.reown.com, then set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` (Production + Preview) and redeploy.
- farmOS is **read-only**: it reads balances only and never requests signatures or sends transactions.

## 5. Connected accounts (Settings → Connected accounts)
Every provider is optional. When its keys are missing, Settings shows "Not set up" with the exact env var names and callback URL, and nothing else breaks. Tokens are AES-GCM encrypted with `AUTH_SECRET` in the `connected_accounts` table and never reach the browser. Connecting needs an unlocked session first; these logins do **not** unlock farmOS (only the passcode or `ALLOWED_EMAIL` Google can).

Callback URL pattern: `https://farmos-os.vercel.app/api/auth/callback/<provider>`. Add the localhost one too if you develop locally.

**X** (Feed → X timeline, read-only)
1. https://developer.x.com → Projects & Apps → your app → User authentication settings → OAuth 2.0, type **Web App**, permissions **Read**.
2. Callback URL: `https://farmos-os.vercel.app/api/auth/callback/x`. Website URL: `https://farmos-os.vercel.app`. "You weren't able to give access to the App" means the callback doesn't match exactly or OAuth 2.0 isn't enabled as a Web App (confidential client).
3. Copy the OAuth 2.0 Client ID and Secret into `X_CLIENT_ID` and `X_CLIENT_SECRET`.
4. Scopes requested: `users.read tweet.read follows.read offline.access`. The home timeline needs a paid X API tier (Basic or higher). On Free, the Feed shows X's plan message instead of posts. On 429 it shows the rate-limit message.

**Discord** (identity on your profile)
1. https://discord.com/developers/applications → New Application → OAuth2.
2. Redirect: `https://farmos-os.vercel.app/api/auth/callback/discord`.
3. `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`. Scope: `identify` only.

**GitHub** (identity, public profile)
1. https://github.com/settings/developers → New OAuth App.
2. Homepage `https://farmos-os.vercel.app`, callback `https://farmos-os.vercel.app/api/auth/callback/github`.
3. `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`. Scope: `read:user`.

**Telegram** (bot deep link; Login Widget as fallback)

Settings → Connected accounts → Telegram → **Connect** opens `t.me/<bot>?start=<one-time token>`. Press **Start** in Telegram and farmOS links the account within a few seconds (it reads the `/start` message with `getUpdates`, so the bot must not have a webhook). No phone number or popup. "or use Telegram Login" shows the official widget in redirect mode (`data-auth-url` → `/api/connections/telegram/callback`); with the widget, Telegram sends a confirmation message to your Telegram app that you must accept.

1. In Telegram, message @BotFather → `/newbot` → copy the token into `TELEGRAM_BOT_TOKEN` (server-only).
2. Send `/setdomain` to @BotFather, choose the bot, and enter `farmos-os.vercel.app`.
3. Set `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` to the bot username without `@` (public by design).
4. farmOS checks the widget payload's HMAC with the bot token and rejects payloads older than 24 h.

**Farcaster** (public profile)
No keys needed. Enter your username; farmOS reads the public profile from the Farcaster (Warpcast) API. It is a display link, not a verified sign-in (that would need a signature, which farmOS never asks for).

**Google**: see section 2.

Redeploy after adding any env var (`vercel --prod`).

## 6. Upcoming mints (OpenSea)
1. Get an API key at https://docs.opensea.io/reference/api-keys and set `OPENSEA_API_KEY` (Production + Preview, sensitive). It stays server-side.
2. NFT → Upcoming mints lists OpenSea's upcoming and featured drops with stages, price, supply, and a countdown.
3. **Check eligibility** tests every saved wallet (Wallets page), read-only:
   - Public stage: open to everyone.
   - The stage that is live right now: farmOS asks OpenSea to *build* (not send) a 1-token mint for the wallet with only the API key. OpenSea answers 200 (on the list) or `MINTER_NOT_ELIGIBLE`. The returned calldata is thrown away; nothing is signed or sent.
   - SeaDrop Merkle allowlists: farmOS reads the root from the SeaDrop contract on-chain, finds the `AllowListUpdated` event's published list, rebuilds the root to confirm the file, and checks each wallet. Set `ETHERSCAN_API_KEY` to search the full log history; without it only roughly the last 49k blocks are searched.
   - Token-gated stages: checks on-chain whether the wallet holds a gate NFT.
   - Signed presales that are not live yet: OpenSea only reveals these to a signed-in wallet, so farmOS shows "Unknown", re-checks when the stage opens, and lets you keep a manual status, the project's own checker link, and a note.
4. **Watch** keeps a drop under Watching. **Track as project** creates an NFT project with the mint date and OpenSea link.

## 7. Attachments (Vercel Blob)
The private Blob store `frioos-files` (region `sin1`) is connected to the project for Production, Preview, and Development, which provides `BLOB_READ_WRITE_TOKEN`. Files on projects (Files tab) and diary entries are stored privately and streamed through `/api/attachments/<id>/file` after the session check. The app limit is 4 MB per file, which keeps uploads under Vercel's function body limit.

Hobby (free) included usage: 1 GB storage/month (monthly average), 10,000 simple operations, 2,000 advanced operations, and 10 GB Blob data transfer. Going over a limit is not billed; Blob access is blocked until the 30-day usage window resets. Source: https://vercel.com/docs/vercel-blob/usage-and-pricing.

## 8. Telegram notifications (Settings → Notifications)
Uses the existing bot `@friofarmOS_bot` (`TELEGRAM_BOT_TOKEN`). The bot only sends you messages; it never reads anything else.
1. Settings → Notifications → **Link Telegram**. Telegram opens the bot with a one-time `/start` token (valid 30 minutes). Press **Start**.
2. Back in farmOS press **I pressed Start**. farmOS reads the bot's pending updates (`getUpdates`, no webhook), finds the token, and saves that chat id.
   - Shortcut: **Use connected account** reuses the Telegram account from Connected accounts (works once you have pressed Start in the bot at least once).
3. Toggle sections: mint countdowns (watched mints starting within 24h + projects with a mint date today/tomorrow), campaign deadlines (deadline, campaign end, snapshot, TGE, claim open/close in the next 3 days), today's open tasks, streaks at risk (due today, streak ≥ 2).
4. **Send test** sends today's digest now. `GET /api/notify/test` previews it without sending.

The digest runs from Vercel Cron `/api/cron/daily` at `0 0 * * *` UTC = **07:00 WIB** (Hobby allows daily crons; Vercel may fire anywhere within that hour). The route is public in the proxy but requires `Authorization: Bearer $CRON_SECRET`, which Vercel adds automatically. Days are computed in `APP_TZ` (default `Asia/Jakarta`).

## 9. Wallet auto-track (Wallets page)
For every saved wallet, the server reads native balances plus main tokens (USDC, USDT, WETH, ARB, OP) on Ethereum, Base, Robinhood Chain, Ink, BSC, HyperEVM, Elysium (chain id 99901, `rpc.elysium.kinetiq.xyz`), Arbitrum, Optimism and Avalanche, and native SOL for Solana addresses (public RPC). Read-only, no signatures. The Portfolio page sums these balances across every linked wallet (add as many as you like there or on Wallets).
- Native balances: Etherscan V2 `balancemulti` where the free plan covers the chain; public RPC for the rest (Base, Optimism, BSC, Ink, Robinhood Chain, Elysium).
- ERC-20 balances: Multicall3 over public RPC; decimals are read on-chain.
- USD: CoinGecko simple price for natives/WETH/ARB/OP, stablecoins at $1. Assets without a price show "no price" and are left out of totals.
- Cached for 10 minutes in `settings.wallet_track` (refetched immediately if the wallet list changes); **Refresh** forces it; the daily cron refreshes too.
- **Degen positions, on-chain**: open positions with a token address on a known chain get their on-chain size summed across linked wallets. PnL = on-chain size × (current − entry). **Use on-chain size** writes it back to the position.

## 10. Airdrop checker (project → Eligibility tab)
Only real sources; with nothing configured the tab says **No checker configured**.
- **Checker API (JSON)**: the project's public endpoint with `{address}`, e.g. `https://api.project.xyz/eligibility/{address}`. Optional field path (`amount`, `data.eligible`). A 404 counts as not eligible.
- **Claim contract view**: chain + contract + a view taking one address, e.g. `claimable(address) returns (uint256)`. Read with `eth_call` only.
- **Merkle / claims list (JSON)**: a published claims file, `{ "0xabc…": "123" }` or `[{ address, amount }]`.
- Optional decimals scale raw integer amounts (wei-style). Optional claim page link.
Wallets checked: the ones tagged on the project, otherwise all linked EVM wallets. https only, 12 s timeout, 5 MB max response. Results are stored on the project (`projects.checker.lastRun`).

## 11. Backup, export and restore (Settings → Data)
- **JSON backup** `GET /api/export`: all tables. Never included: OAuth/Google tokens (`connected_accounts`, `google_tokens`), the encrypted AI key, the Telegram link, and the wallet cache.
- **CSV per table** `GET /api/export?format=csv&table=<name>` for projects, positions, tasks, completions, diary, wallets, mints, feed, attachments, threads. Arrays/objects are JSON inside the cell; formula-looking cells are prefixed with `'`.
- **Import JSON**: uploads are first validated (dry run with row counts), then a confirm dialog. On confirm farmOS saves a safety snapshot to Blob, then replaces all data in one transaction. Your AI key and Telegram link are kept. Upload limit 4 MB.
- **Daily snapshots**: the daily cron writes `backups/farmos-YYYY-MM-DD.json` to the private Blob store and keeps the newest 7. **Snapshot now** saves one immediately; snapshots download through `/api/backups?download=…` after the session check.

## 12. Install as an app (PWA)
farmOS ships a web manifest, PNG + maskable icons (`public/icons`, rendered from `src/app/icon.svg` by `node scripts/gen-pwa-icons.mjs`) and a service worker (`public/sw.js`) that caches only the offline page and static build assets. API data is never cached.
- Android/Chrome: open the site → menu → **Install app**.
- iPhone/Safari: Share → **Add to Home Screen**.
Offline, navigations show a small "You're offline" page.

## 13. Custom domain
Current: free `*.vercel.app`: `farmos-os.vercel.app` (canonical) and `frioos-iota.vercel.app` (redirects to it; set `ALIAS_HOSTS` to change the list). Nothing has been bought. To add one later: buy any domain (Vercel Domains or any registrar), add it under Vercel → Project → Domains, then set `APP_URL` to it and add it to the Google OAuth client (origin + redirect), Telegram `/setdomain`, X/Discord/GitHub callbacks, and the Reown allowlist.

## 14. Chains, logos and AI review
- Supported chains (selectors, wallet tracking, AI proposals): Ethereum, Base, Robinhood Chain, Ink, BSC, HyperEVM, Elysium, Solana, Zcash, Monero, Aptos, Sui, Arbitrum, Optimism, Avalanche (`src/lib/chain-meta.ts`). Official logos are self-hosted in `public/chains`. Older chain names were normalised by `npx tsx scripts/migrate-chains.mjs --apply` (aliases → canonical name; unsupported chains move into tags as `chain:<name>`).
- Wallet app icons (MetaMask, Rabby, Phantom, OKX, Coinbase, Rainbow, Trust, Binance, Bitget, Backpack, Zerion, WalletConnect) are the official marks shipped with RainbowKit, in `public/wallets`. A linked wallet remembers its app (`wallets.provider`); pick it from the icon on the Wallets page.
- Project logos come from the project's X profile picture (X link → `/api/avatar/x/<handle>`, fetched through unavatar.io without keys, cached 1 day in the browser and 7 days on Vercel's CDN). No X link or no picture → the monogram.
- **AI review** (project → Rating → AI review): the research desk checks the sources with its tools, answers the audit questionnaire with evidence only, and suggests a star rating, tier, risk and verdict with reasons and sources. Nothing changes until you press **Accept** (or **Use answers in audit** to pre-fill the questionnaire).
- **Feed + AI**: **AI brief** streams a short briefing of today's reading list (`/api/feed/digest`); **Ask AI** on any item opens the Research desk with that item as the question.

## Env var reference
| Var | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` (+ Neon vars) | yes | set by the Neon integration |
| `APP_PASSCODE` | yes | passcode gate |
| `AUTH_SECRET` | yes | signs sessions, encrypts stored secrets |
| `APP_URL` | yes | `https://farmos-os.vercel.app` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_EMAIL` | optional | enables Google (Gmail, Calendar, and Google sign-in unlock); set on Production + Preview |
| `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` | optional | or configure in Settings |
| `ETHERSCAN_API_KEY` | optional | richer audits + full-history SeaDrop allowlists; set on Production + Preview |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | optional | WalletConnect; public by design; set on Production + Preview |
| `OPENSEA_API_KEY` | optional | Upcoming mints + live-stage WL check |
| `BLOB_READ_WRITE_TOKEN` | optional | attachments (set by the Blob integration on Production, Preview, and Development) |
| `X_CLIENT_ID`, `X_CLIENT_SECRET` | optional | X connection + Feed timeline; set on Production + Preview |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | optional | Discord connection; set on Production + Preview |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | optional | GitHub connection; set on Production + Preview |
| `TELEGRAM_BOT_TOKEN`, `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | optional | Telegram Login Widget; set on Production + Preview (`NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` is `friofarmOS_bot`) |
| `CRON_SECRET` | yes for cron | random secret, Production + Preview (sensitive); Vercel sends it as `Authorization: Bearer` to `/api/cron/daily` |
| `APP_TZ` | optional | day boundary for digest/backups, default `Asia/Jakarta` |
| `ALIAS_HOSTS` | optional | comma-separated hosts that redirect to `APP_URL`, default `frioos-iota.vercel.app` |

## Convert, earnings, claim alerts, reports

- **Convert card** (Today): CoinGecko simple price with USD (default)/USDT/IDR/PHP and token logos from CoinGecko search/markets; USDT = USD ÷ Tether. Shared cache in `settings(_global, price_cache)` (3 min fresh), falling back to DefiLlama coins + open.er-api FX, then the last known price marked “cached”. Optional `COINGECKO_API_KEY` (demo key) raises the rate limit.
- **Default currency** per profile: Iya IDR, Nadine PHP (Settings → Profile can change it).
- **Claim watches** run in both crons: `/api/cron/daily` (00:00 UTC) and `/api/cron/alerts` (12:00 UTC). Vercel Hobby allows one run per cron per day, so alerts land twice a day; "Check alerts" runs them on demand. The `/prices` page and watchlist UI were removed; the `watchlist` table and `/api/watchlist` routes remain but nothing checks them. Telegram toggles: Settings → Notifications → Instant alerts.
- **Claim watch types**: claim page goes live (HTTP 2xx + optional match text), checker API, claim contract view, Merkle claims list, or status only. Read-only; never signs or sends.
- **Earnings**: project → Earnings tab. **Reports**: `/report` (print → PDF) and `/api/reports?month=YYYY-MM&format=csv`.
- Migration: `node scripts/migrate-0001.mjs --apply` (backs up every table to /workspace/backups first, verifies row counts).
