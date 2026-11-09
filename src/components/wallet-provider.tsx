"use client";
import { RainbowKitProvider, connectorsForWallets, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { coinbaseWallet, injectedWallet, metaMaskWallet, rabbyWallet, rainbowWallet, walletConnectWallet } from "@rainbow-me/rainbowkit/wallets";
import "@rainbow-me/rainbowkit/styles.css";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";
import type { Chain } from "viem";
import { WagmiProvider, createConfig, http } from "wagmi";
import { EVM_CHAINS, WALLET_CHAIN_KEYS, rpcFor } from "@/lib/chains";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ?? "";
export const walletConnectReady = Boolean(projectId);

const chains = WALLET_CHAIN_KEYS.map((k) => EVM_CHAINS.find((c) => c.key === k)!.chain) as [Chain, ...Chain[]];

const connectors = connectorsForWallets(
  walletConnectReady
    ? [
        { groupName: "Popular", wallets: [rabbyWallet, metaMaskWallet, coinbaseWallet, rainbowWallet, walletConnectWallet] },
        { groupName: "Other", wallets: [injectedWallet] },
      ]
    : [{ groupName: "Browser wallet", wallets: [injectedWallet, rabbyWallet] }],
  // RainbowKit requires a value; without a real id only injected wallets are offered (no WalletConnect relay).
  { appName: "frioOS", projectId: projectId || "frioos-injected-only" },
);

export const wagmiConfig = createConfig({
  chains,
  connectors,
  transports: Object.fromEntries(chains.map((c) => [c.id, http(rpcFor(c))])),
  ssr: true,
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark"
    ? darkTheme({ accentColor: "#e07a48", accentColorForeground: "#1a1310", borderRadius: "medium", fontStack: "system", overlayBlur: "none" })
    : lightTheme({ accentColor: "#b8572b", accentColorForeground: "#ffffff", borderRadius: "medium", fontStack: "system", overlayBlur: "none" });
  return (
    <WagmiProvider config={wagmiConfig}>
      <RainbowKitProvider theme={theme} modalSize="compact" appInfo={{ appName: "frioOS", disclaimer: () => <p style={{ fontSize: 12 }}>frioOS is read-only. It never requests transactions or signatures.</p> }}>
        {children}
      </RainbowKitProvider>
    </WagmiProvider>
  );
}
