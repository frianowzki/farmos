import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, EB_Garamond, Google_Sans, Google_Sans_Code, Jost } from "next/font/google";
import { Providers } from "@/components/providers";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { ACCENT_BOOT } from "@/lib/accent";
import "./globals.css";

// Type system (all SIL OFL 1.1 via Google Fonts, self-hosted by next/font):
// - Google Sans: UI text. Descendant of Product Sans (Alphabet logo, fontinlogo.com).
// - EB Garamond: page titles and display. Open Garamond revival (fontinlogo.com: Garamond).
// - Jost: small-caps section labels. Futura-style geometric (fontinlogo.com: Futura).
// - Bricolage Grotesque: the farmOS wordmark and the Today date. A characterful grotesque in the
//   Franklin/Grotesk logo tradition (fontinlogo.com: Franklin Gothic), with optical sizes for display.
// - Google Sans Code: numbers, addresses, code. Same family as the UI face.
const sans = Google_Sans({ variable: "--font-gsans", subsets: ["latin"], display: "swap" });
const display = EB_Garamond({ variable: "--font-garamond", subsets: ["latin"], style: ["normal", "italic"], display: "swap" });
const label = Jost({ variable: "--font-jost", subsets: ["latin"], display: "swap" });
const wordmark = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], display: "swap", axes: ["opsz", "wdth"] });
const mono = Google_Sans_Code({ variable: "--font-gmono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "farmOS", template: "%s · farmOS" },
  description: "A private workspace for airdrops, testnets, NFT whitelists and degen plays.",
  robots: { index: false, follow: false },
  applicationName: "farmOS",
  appleWebApp: { capable: true, title: "farmOS", statusBarStyle: "black-translucent" },
  icons: { icon: [{ url: "/favicon.ico", sizes: "48x48" }, { url: "/icon.svg", type: "image/svg+xml" }], apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#171615" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: ACCENT_BOOT }} />
      </head>
      <body className={`${sans.variable} ${display.variable} ${label.variable} ${wordmark.variable} ${mono.variable} antialiased`}>
        <Providers>{children}</Providers>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
