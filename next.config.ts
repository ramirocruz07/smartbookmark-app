import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure proper production builds
  reactStrictMode: true,
  // Optimize for production
  swcMinify: true,
};

export default nextConfig;
