import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["@notionhq/client"],
};

export default nextConfig;
