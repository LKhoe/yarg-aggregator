import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
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
    ],
  },
};

export default withNextIntl(nextConfig);
