import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    turbo: {
      root: path.join(__dirname, "../.."),
    },
  },
};

export default nextConfig;
