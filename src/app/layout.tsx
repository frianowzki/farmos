import type { Metadata, Viewport } from "next";
import { EB_Garamond, Google_Sans, Google_Sans_Code, Jost } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

// Type system (all SIL OFL 1.1 via Google Fonts, self-hosted by next/font):
// - Google Sans: UI text. Descendant of Product Sans (Alphabet logo, fontinlogo.com).
// - EB Garamond: page titles and display. Open Garamond revival (fontinlogo.com: Garamond).
// - Jost: small-caps eyebrow labels and the wordmark. Futura-style geometric (fontinlogo.com: Futura).
// - Google Sans Code: numbers, addresses, code. Same family as the UI face.
const sans = Google_Sans({ variable: "--font-gsans", subsets: ["latin"], display: "swap" });
const display = EB_Garamond({ variable: "--font-garamond", subsets: ["latin"], style: ["normal", "italic"], display: "swap" });
const label = Jost({ variable: "--font-jost", subsets: ["latin"], display: "swap" });
const mono = Google_Sans_Code({ variable: "--font-gmono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "farmOS", template: "%s · farmOS" },
  description: "A private workspace for airdrops, testnets, NFT whitelists and degen plays.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#171615" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sans.variable} ${display.variable} ${label.variable} ${mono.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
