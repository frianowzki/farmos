import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "farmOS",
    short_name: "farmOS",
    description: "A private desk for airdrops, testnets, NFT mints and degen plays.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#171615",
    theme_color: "#171615",
    categories: ["productivity", "finance"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Today", url: "/", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Daily tasks", url: "/tasks", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Upcoming mints", url: "/mints", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
