import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    const workerBase = process.env.INTERNAL_WORKER_URL
      ? process.env.INTERNAL_WORKER_URL
      : process.env.NODE_ENV === "production"
        ? "http://worker:8787"
        : "http://localhost:8787";
    return [
      {
        source: "/api/:path*",
        destination: `${workerBase}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
