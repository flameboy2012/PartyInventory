import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Minimal, self-contained server bundle for Docker images.
  output: "standalone",
};

export default nextConfig;
