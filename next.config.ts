import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/metadata": ["./vendor/yt-dlp/**/*"],
    "/api/thumbnail": ["./vendor/yt-dlp/**/*"],
    "/api/download": ["./vendor/yt-dlp/**/*", "./node_modules/ffmpeg-static/**/*"],
    "/api/convert": ["./vendor/yt-dlp/**/*", "./node_modules/ffmpeg-static/**/*"],
  },
};

export default nextConfig;
