# farmOS setup

Production: https://farmos-os.vercel.app and https://frioos-iota.vercel.app (Vercel project `frioos`, team frianowzkis-projects).

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
   - Publishing status: leave it in **Testing** and add your own Gmail under **Test users**. Testing mode means no Google verification is needed. Refresh tokens in Testing mode expire after 7 days, so if mail stops loading, reconnect in Settings.
4. Under APIs & Services → Credentials → Create credentials → OAuth client ID:
   - Type: **Web application**.
   - Authorized JavaScript origin: `https://frioos-iota.vercel.app`.
   - Authorized redirect URI: `https://frioos-iota.vercel.app/api/auth/callback/google`.
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

Callback URL pattern: `https://frioos-iota.vercel.app/api/auth/callback/<provider>`. Add the localhost one too if you develop locally.

**X** (Feed → X timeline, read-only)
1. https://developer.x.com → Projects & Apps → your app → User authentication settings → OAuth 2.0, type **Web App**, permissions **Read**.
2. Callback URL: `https://frioos-iota.vercel.app/api/auth/callback/x`. Website URL: `https://frioos-iota.vercel.app`.
3. Copy the OAuth 2.0 Client ID and Secret into `X_CLIENT_ID` and `X_CLIENT_SECRET`.
4. Scopes requested: `users.read tweet.read follows.read offline.access`. The home timeline needs a paid X API tier (Basic or higher). On Free, the Feed shows X's plan message instead of posts. On 429 it shows the rate-limit message.

**Discord** (identity on your profile)
1. https://discord.com/developers/applications → New Application → OAuth2.
2. Redirect: `https://frioos-iota.vercel.app/api/auth/callback/discord`.
3. `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`. Scope: `identify` only.

**GitHub** (identity, public profile)
1. https://github.com/settings/developers → New OAuth App.
2. Homepage `https://frioos-iota.vercel.app`, callback `https://frioos-iota.vercel.app/api/auth/callback/github`.
3. `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`. Scope: `read:user`.

**Telegram** (official Login Widget)
1. In Telegram, message @BotFather → `/newbot` → copy the token into `TELEGRAM_BOT_TOKEN` (server-only).
2. Send `/setdomain` to @BotFather, choose the bot, and enter `frioos-iota.vercel.app`.
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

## Env var reference
| Var | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` (+ Neon vars) | yes | set by the Neon integration |
| `APP_PASSCODE` | yes | passcode gate |
| `AUTH_SECRET` | yes | signs sessions, encrypts stored secrets |
| `APP_URL` | yes | `https://frioos-iota.vercel.app` |
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
