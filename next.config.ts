import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so Turbopack doesn't pick up unrelated lockfiles
  // higher up the filesystem.
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
