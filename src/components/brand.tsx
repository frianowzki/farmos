/**
 * Official brand app icons (sourced from iconly.design's index of official App Store / web app icons,
 * self-hosted in /public/brands, resized to 128px). Farcaster is not in iconly's index, so its official App Store icon is used. Used only to label real connections/brands.
 */
import { cn } from "@/lib/cn";

export const BRANDS = {
  google: "Google",
  farcaster: "Farcaster",
  x: "X",
  telegram: "Telegram",
  discord: "Discord",
  github: "GitHub",
  gmail: "Gmail",
  "google-calendar": "Google Calendar",
  phantom: "Phantom",
  okx: "OKX Wallet",
  "coinbase-wallet": "Coinbase Wallet",
  "trust-wallet": "Trust Wallet",
  uniswap: "Uniswap Wallet",
  binance: "Binance",
  opensea: "OpenSea",
  base: "Base",
  deepseek: "DeepSeek",
} as const;
export type BrandId = keyof typeof BRANDS;

export function BrandIcon({ id, size = 20, className, decorative = true }: { id: BrandId; size?: number; className?: string; decorative?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/brands/${id}.webp`}
      width={size}
      height={size}
      alt={decorative ? "" : BRANDS[id]}
      aria-hidden={decorative || undefined}
      loading="lazy"
      className={cn("shrink-0 rounded-[22%] shadow-[0_0_0_0.5px_rgba(0,0,0,0.08)]", className)}
      style={{ width: size, height: size }}
    />
  );
}
