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

export type MediaDownloader =
  | "ytdlp"
  | "cobalt";

export function getMediaDownloader(): MediaDownloader {
  const configured =
    process.env.MEDIA_DOWNLOADER
      ?.trim()
      .toLowerCase();

  if (configured === "cobalt") {
    return "cobalt";
  }

  return "ytdlp";
}

export async function inspectMedia(
  url: string
) {
  if (getMediaMode() === "server") {
    return inspectNativeMedia(url);
  }

  if (getMediaDownloader() === "cobalt") {
    return inspectCobaltMedia(url);
  }

  return inspectWithYtDlp(url);
}

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

  if (getMediaDownloader() === "cobalt") {
    const result =
      await resolveCobaltDownload(url, {
        type: "video",
        quality:
          formatId &&
          /^\d+$/.test(formatId)
            ? formatId
            : "max",
      });

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

export async function resolveCobaltMedia(
  url: string,
  options: {
    type: "video" | "audio";
    quality?: string;
    bitrate?: string;
  }
) {
  if (getMediaDownloader() !== "cobalt") {
    throw new Error(
      "Cobalt downloader is not enabled."
    );
  }

  return resolveCobaltDownload(
    url,
    options
  );
}

export function runYtDlp(
  url: string,
  flags: Record<string, unknown>,
  options?: Record<string, unknown>
) {
  if (
    getMediaDownloader() === "cobalt"
  ) {
    throw new Error(
      "yt-dlp is disabled because MEDIA_DOWNLOADER=cobalt."
    );
  }

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