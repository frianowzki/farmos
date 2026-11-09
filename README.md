# farmOS

A personal crypto workspace for airdrops, testnets, NFT whitelists, and degen positions. It covers projects (ratings, audits, accents, campaign windows, files), daily tasks and streaks, a Recap of each day, a diary, a daily AI reading list plus your X timeline, upcoming OpenSea mints with read-only WL checks, read-only wallets, Gmail/Calendar, and an AI research desk.

UI: beUI Motion components (sidebar, dock, tabs, timeline, wheel picker, date range picker, color selector, toast stack, loader…), PanelUI web registry items (button, dialog, charts, KPI, frame), and faithful web rebuilds of PanelUI's native-only pieces. Fonts: EB Garamond (display), Google Sans (UI), Jost (labels), Google Sans Code (numbers/addresses), all OFL via next/font.

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, shadcn/ui (base), Motion, Drizzle + Neon, Auth.js v5, RainbowKit/wagmi/viem (read-only), AI SDK with an OpenAI-compatible provider.

```bash
npm install
vercel env pull .env.local   # DATABASE_URL, APP_PASSCODE, AUTH_SECRET …
npm run db:push              # apply schema
npm run dev
npm run typecheck && npm run lint && npm test && npm run build
```

- Setup for Google, the AI desk, WalletConnect, connected accounts (X, Discord, GitHub, Telegram, Farcaster), OpenSea mints, and Blob attachments: see [SETUP.md](./SETUP.md).
- Smoke test: `FRIO_PASSCODE=… node scripts/smoke.mjs https://frioos-iota.vercel.app`
- Screenshots: `FRIO_PASSCODE=… node scripts/shots.mjs <base> screenshots`
