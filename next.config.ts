import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  generateBuildId: async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { version } = require("./package.json");
    return version;
  },
  webpack: (config) => {
    // Resolve .ts files when importing with .js extension (ESM convention used by batch-extractor)
    config.resolve.extensionAlias = {
      ".js": [".ts", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
      {
        source: "/api/genres",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" },
        ],
      },
      {
        source: "/api/music",
        headers: [
          { key: "Cache-Control", value: "public, max-age=30, stale-while-revalidate=120" },
        ],
      },
    ];
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "files.enchor.us",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "rhythmverse.co",
        port: "",
        pathname: "/assets/**",
      },
      {
        protocol: "https",
        hostname: "**.googleusercontent.com",
        port: "",
        pathname: "/a/**",
      },
      {
        protocol: "https",
        hostname: "i.ytimg.com",
        port: "",
        pathname: "/vi/**/**",
      },
    ],
  },
};

export default withNextIntl(nextConfig);
