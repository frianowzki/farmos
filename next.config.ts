import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // frioOS is a single-user, request-driven workspace (session cookie, DB, Google tokens).
  // Cache Components stays off so every route reads fresh data.
  poweredByHeader: false,
  turbopack: {
    resolveAlias: {
      // Wallet connectors only need the browser SDK; avoid the Node export's optional deps.
      "@base-org/account": "./node_modules/@base-org/account/dist/index.js",
    },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
