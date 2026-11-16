import type { NextConfig } from "next";

const serverMode = process.env.MEDIA_MODE?.trim().toLowerCase() === "server" || Boolean(process.env.VERCEL);

const nextConfig: NextConfig = {
  ...(serverMode ? {} : {
    outputFileTracingIncludes: {
      "/api/metadata": ["./vendor/yt-dlp/**/*"],
      "/api/thumbnail": ["./vendor/yt-dlp/**/*"],
      "/api/download": ["./vendor/yt-dlp/**/*", "./node_modules/ffmpeg-static/**/*"],
      "/api/convert": ["./vendor/yt-dlp/**/*", "./node_modules/ffmpeg-static/**/*"],
    },
  }),
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ],
      },
    ];
  },
};

export default nextConfig;
