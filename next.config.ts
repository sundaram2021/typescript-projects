import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
        {
            source: '/api/video-call/signal',
            headers: [
                { key: 'Access-Control-Allow-Origin', value: '*' }, // Replace '*' with your domain in production
                { key: 'Access-Control-Allow-Methods', value: 'GET' },
            ],
        },
    ];
  },
  eslint: {
    ignoreDuringBuilds: true, // Disables ESLint during `next build`
  },
};

export default nextConfig;
