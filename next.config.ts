import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.enchor.us',
      },
      {
        protocol: 'https',
        hostname: '**.rhythmverse.co',
      },
    ],
  },
};

export default nextConfig;
