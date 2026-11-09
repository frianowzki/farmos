# frioOS

A personal crypto workspace for airdrops, testnets, NFT whitelists, and degen positions. It covers projects, daily tasks and streaks, a diary, read-only wallets, Gmail/Calendar, and an AI research desk.

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, shadcn/ui (base), Motion, Drizzle + Neon, Auth.js v5, RainbowKit/wagmi/viem (read-only), AI SDK with an OpenAI-compatible provider.

```bash
npm install
vercel env pull .env.local   # DATABASE_URL, APP_PASSCODE, AUTH_SECRET …
npm run db:push              # apply schema
npm run dev
npm run typecheck && npm run lint && npm test && npm run build
```

- Setup for Google, the AI desk, and WalletConnect: see [SETUP.md](./SETUP.md).
- Smoke test: `FRIO_PASSCODE=… node scripts/smoke.mjs https://frioos-iota.vercel.app`
- Screenshots: `FRIO_PASSCODE=… node scripts/shots.mjs <base> screenshots`
