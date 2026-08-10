import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NOTE: no `output: "standalone"` — the app deploys on Vercel, which does its
  // own serverless bundling (standalone also broke Vercel's onBuildComplete
  // tracing hook: ENOENT .next/next-server.js.nft.json).
  reactStrictMode: false,
};

export default nextConfig;
