# frioOS setup

Production: https://frioos-iota.vercel.app (Vercel project `frioos`, team frianowzkis-projects).

## 0. Unlock
- The app is behind a passcode gate (`APP_PASSCODE`, kept in an httpOnly signed cookie for 30 days).
- The current passcode is stored on the Grok Bot box at `/home/box/secrets/frioos-passcode.txt`.
- To change it: Vercel → frioos → Settings → Environment Variables → edit `APP_PASSCODE` (Production + Preview), then redeploy. Changing `AUTH_SECRET` signs out all sessions.

## 1. Database (already done)
- Neon Postgres via the Vercel Marketplace, connected to the project. Vercel injects `DATABASE_URL` and the related vars.
- Schema: `src/db/schema.ts`. Apply changes with `npm run db:push` (needs `DATABASE_URL_UNPOOLED` locally: `vercel env pull .env.local`).

## 2. Google (Gmail read-only + Calendar sync)
Until these env vars exist, the Mail and Calendar sections show a setup card. No fake data is shown.

1. Go to https://console.cloud.google.com and create a project (for example "frioOS").
2. Under APIs & Services → Library, enable the **Gmail API** and the **Google Calendar API**.
3. Under APIs & Services → OAuth consent screen:
   - User type: External.
   - App name: frioOS, with your email as support/developer contact.
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
7. In frioOS → Settings → Google, click **Connect Google**.

What it does:
- Mail lists recent messages (read-only scope) and matches them to projects by each project's "Mail matchers" (domains, senders, keywords).
- Calendar shows upcoming events and can push project deadlines and key dates as all-day events ("Sync to Calendar").
- OAuth tokens are stored AES-GCM-encrypted in the database and never reach the browser.
- Disconnect from Settings at any time. You can also revoke access at https://myaccount.google.com/permissions.

Google sign-in can also unlock the app instead of the passcode, but only for `ALLOWED_EMAIL`.

## 3. AI desk (OpenAI-compatible, e.g. DeepSeek)
Option A, in the UI: Settings → AI, enter Base URL, API key, and Model, then **Test connection**. The key is encrypted server-side (with `AUTH_SECRET`). It is never returned to the browser; the UI only shows "key saved".

Option B, env vars (used as fallback when the Settings fields are empty; Settings wins if both are set):
- `AI_BASE_URL`: for DeepSeek, `https://api.deepseek.com/v1`
- `AI_API_KEY`: your DeepSeek key (`sk-...`)
- `AI_MODEL`: `deepseek-chat`. `deepseek-reasoner` also works, but tool calling is best on deepseek-chat.

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
- frioOS is **read-only**: it reads balances only and never requests signatures or sends transactions.

## Env var reference
| Var | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` (+ Neon vars) | yes | set by the Neon integration |
| `APP_PASSCODE` | yes | passcode gate |
| `AUTH_SECRET` | yes | signs sessions, encrypts stored secrets |
| `APP_URL` | yes | `https://frioos-iota.vercel.app` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_EMAIL` | optional | enables Google |
| `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` | optional | or configure in Settings |
| `ETHERSCAN_API_KEY` | optional | richer audits |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | optional | WalletConnect; public by design |
