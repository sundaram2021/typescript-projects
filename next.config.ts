import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/api/video-call/signal",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" }, // Adjust this to your domain in production
          { key: "Access-Control-Allow-Methods", value: "GET, POST" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
        ],
      },
    ];
  },
  eslint: {
    ignoreDuringBuilds: true, // Disables ESLint during `next build`
  },
};

export default nextConfig;
