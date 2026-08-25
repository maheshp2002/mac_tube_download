import { getMediaMode } from "./mode";

import {
  inspectNativeMedia,
  resolveNativeDirectMediaUrl,
} from "./native";

import {
  inspectMedia as inspectWithYtDlp,
  resolveDirectMediaUrl as resolveWithYtDlp,
  runYtDlp as runWithYtDlp,
} from "./yt-dlp";

import {
  inspectCobaltMedia,
  resolveCobaltDownload,
} from "./cobalt";

export { getMediaMode };

export type YoutubeDownloader =
  | "ytdlp"
  | "cobalt";

/**
 * Controls ONLY how YouTube is extracted.
 *
 * All non-YouTube sources continue using yt-dlp.
 *
 * Local:
 *   YOUTUBE_DOWNLOADER=ytdlp
 *
 * Render:
 *   YOUTUBE_DOWNLOADER=cobalt
 */
export function getYoutubeDownloader(): YoutubeDownloader {
  const configured =
    process.env.YOUTUBE_DOWNLOADER
      ?.trim()
      .toLowerCase();

  return configured === "cobalt"
    ? "cobalt"
    : "ytdlp";
}

/**
 * Detect YouTube URLs.
 */
export function isYoutubeUrl(
  url: string
): boolean {
  try {
    const parsed = new URL(url);

    const hostname =
      parsed.hostname.toLowerCase();

    return (
      hostname === "youtube.com" ||
      hostname === "www.youtube.com" ||
      hostname === "m.youtube.com" ||
      hostname === "music.youtube.com" ||
      hostname === "youtu.be" ||
      hostname.endsWith(".youtube.com")
    );
  } catch {
    return false;
  }
}

/**
 * Inspect media metadata.
 *
 * server mode:
 *   native backend
 *
 * local mode:
 *   YouTube + cobalt -> Cobalt
 *   everything else  -> yt-dlp
 */
export async function inspectMedia(
  url: string
) {
  if (getMediaMode() === "server") {
    return inspectNativeMedia(url);
  }

  if (
    isYoutubeUrl(url) &&
    getYoutubeDownloader() === "cobalt"
  ) {
    return inspectCobaltMedia(url);
  }

  return inspectWithYtDlp(url);
}

/**
 * Resolve a direct media URL.
 *
 * server mode:
 *   native backend
 *
 * local mode:
 *   YouTube + cobalt -> Cobalt
 *   everything else  -> yt-dlp
 */
export async function resolveDirectMediaUrl(
  url: string,
  formatId?: string
) {
  if (getMediaMode() === "server") {
    return resolveNativeDirectMediaUrl(
      url,
      formatId
    );
  }

  if (
    isYoutubeUrl(url) &&
    getYoutubeDownloader() === "cobalt"
  ) {
    const result =
      await resolveCobaltDownload(
        url,
        {
          type: "video",
          quality:
            formatId &&
            /^\d+$/.test(formatId)
              ? formatId
              : "max",
        }
      );

    return result.url;
  }

  if (!formatId) {
    throw new Error(
      "A local direct download requires a format selection."
    );
  }

  return resolveWithYtDlp(
    url,
    formatId
  );
}

/**
 * Explicit Cobalt operation.
 *
 * Cobalt is ONLY allowed for YouTube.
 */
export async function resolveCobaltMedia(
  url: string,
  options: {
    type: "video" | "audio";
    quality?: string;
    bitrate?: string;
  }
) {
  if (!isYoutubeUrl(url)) {
    throw new Error(
      "Cobalt is only configured for YouTube sources."
    );
  }

  if (
    getYoutubeDownloader() !== "cobalt"
  ) {
    throw new Error(
      "Cobalt is not enabled for YouTube."
    );
  }

  return resolveCobaltDownload(
    url,
    options
  );
}

/**
 * yt-dlp remains available for ALL non-YouTube
 * sources, even when YouTube uses Cobalt.
 *
 * This is important:
 *
 * Render:
 *   YouTube    -> Cobalt
 *   Instagram  -> yt-dlp
 *   TikTok     -> yt-dlp
 *   Facebook   -> yt-dlp
 *   X          -> yt-dlp
 *   etc.
 */
export function runYtDlp(
  url: string,
  flags: Record<string, unknown>,
  options?: Record<string, unknown>
) {
  if (getMediaMode() === "server") {
    throw new Error(
      "yt-dlp is disabled in server mode."
    );
  }

  return runWithYtDlp(
    url,
    flags,
    options
  );
}