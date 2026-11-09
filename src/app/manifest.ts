import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "farmOS",
    short_name: "farmOS",
    description: "A private desk for airdrops, testnets, NFT mints and degen plays.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf8f3",
    theme_color: "#b8572b",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
