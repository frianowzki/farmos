import { Wallet } from "lucide-react";
import { cn } from "@/lib/cn";
import { BRAND_ICON_EXT, WALLET_BRANDS, isWalletBrand } from "@/lib/wallet-brands";

/** Official wallet-app icon; a neutral wallet glyph when the provider is unknown. */
export function WalletIcon({ provider, size = 20, className }: { provider?: string | null; size?: number; className?: string }) {
  if (!provider || !isWalletBrand(provider))
    return (
      <span className={cn("inline-flex shrink-0 items-center justify-center rounded-[28%] bg-hover text-muted", className)} style={{ width: size, height: size }}>
        <Wallet style={{ width: size * 0.55, height: size * 0.55 }} strokeWidth={1.75} />
      </span>
    );
  const name = WALLET_BRANDS.find((b) => b.id === provider)!.name;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/wallets/${provider}.${BRAND_ICON_EXT[provider] ?? "svg"}`} alt={name} title={name} width={size} height={size} className={cn("shrink-0 rounded-[28%] shadow-[0_0_0_0.5px_rgba(0,0,0,0.1)]", className)} style={{ width: size, height: size }} />
  );
}
