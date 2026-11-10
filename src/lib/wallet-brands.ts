/**
 * Wallet apps farmOS can label a wallet with. Icons are official marks: RainbowKit's bundled set, the icons
 * shipped in each wallet's own adapter package (Solflare, Nightly, Slush, Petra, Martian), and the app icons
 * from the Zashi and YWallet repos (/public/wallets).
 */
export const WALLET_BRANDS = [
  { id: "metamask", name: "MetaMask" },
  { id: "rabby", name: "Rabby" },
  { id: "phantom", name: "Phantom" },
  { id: "okx", name: "OKX Wallet" },
  { id: "coinbase", name: "Coinbase Wallet" },
  { id: "rainbow", name: "Rainbow" },
  { id: "trust", name: "Trust Wallet" },
  { id: "binance", name: "Binance Wallet" },
  { id: "bitget", name: "Bitget Wallet" },
  { id: "backpack", name: "Backpack" },
  { id: "zerion", name: "Zerion" },
  { id: "walletconnect", name: "WalletConnect" },
  { id: "solflare", name: "Solflare" },
  { id: "petra", name: "Petra" },
  { id: "martian", name: "Martian" },
  { id: "nightly", name: "Nightly" },
  { id: "slush", name: "Slush" },
  { id: "zashi", name: "Zashi" },
  { id: "ywallet", name: "YWallet" },
] as const;
export type WalletBrandId = (typeof WALLET_BRANDS)[number]["id"];

export const isWalletBrand = (v: string): v is WalletBrandId => WALLET_BRANDS.some((b) => b.id === v);

/** Map a wagmi connector (id / name / rdns) to a wallet brand id. */
export function brandFromConnector(c?: { id?: string; name?: string } | null): WalletBrandId | "" {
  const s = `${c?.id ?? ""} ${c?.name ?? ""}`.toLowerCase();
  if (s.includes("metamask")) return "metamask";
  if (s.includes("rabby")) return "rabby";
  if (s.includes("phantom")) return "phantom";
  if (s.includes("okx")) return "okx";
  if (s.includes("coinbase") || s.includes("base account")) return "coinbase";
  if (s.includes("rainbow")) return "rainbow";
  if (s.includes("trust")) return "trust";
  if (s.includes("binance")) return "binance";
  if (s.includes("bitget")) return "bitget";
  if (s.includes("backpack")) return "backpack";
  if (s.includes("zerion")) return "zerion";
  if (s.includes("walletconnect")) return "walletconnect";
  if (s.includes("solflare")) return "solflare";
  if (s.includes("petra")) return "petra";
  if (s.includes("martian")) return "martian";
  if (s.includes("nightly")) return "nightly";
  if (s.includes("slush") || s.includes("sui wallet")) return "slush";
  return "";
}

/** Icon file per brand (most are SVG). */
export const BRAND_ICON_EXT: Partial<Record<WalletBrandId, "png">> = { petra: "png", martian: "png", zashi: "png", ywallet: "png" };
