import { create as createYtDlp } from "yt-dlp-exec";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { MediaFormat, MediaMetadata } from "./types";

type RawFormat = {
  format_id?: string | number;
  ext?: string;
  width?: number;
  height?: number;
  vcodec?: string;
  acodec?: string;
  filesize?: number;
  filesize_approx?: number;
  format_note?: string;
  resolution?: string;
};

type RawThumbnail = { url?: string; width?: number; height?: number };
type RawInfo = { id?: string | number; webpage_url?: string; title?: string; uploader?: string; channel?: string; duration?: number; thumbnail?: string; thumbnails?: RawThumbnail[]; formats?: RawFormat[] };

export async function inspectMedia(url: string): Promise<MediaMetadata> {
  const info = await createYtDlp(resolveYtDlpBinary())(url, { dumpSingleJson: true, noWarnings: true, noPlaylist: true, skipDownload: true, preferFreeFormats: true });
  const raw = info as RawInfo;
  const rawFormats = Array.isArray(raw.formats) ? raw.formats : [];
  const formats = selectFormats(rawFormats);
  if (!formats.length) throw new Error("Media unavailable. The source did not expose a downloadable video or audio stream.");

  const thumbnails = (raw.thumbnails ?? []).filter((item) => item.url).sort((a, b) => ((b.width ?? 0) * (b.height ?? 0)) - ((a.width ?? 0) * (a.height ?? 0)));
  const thumbnail = thumbnails[0];
  return {
    id: String(raw.id ?? url), sourceUrl: raw.webpage_url ?? url, title: raw.title ?? "Untitled media", author: raw.uploader ?? raw.channel,
    duration: raw.duration, thumbnail: thumbnail?.url ?? raw.thumbnail, thumbnailWidth: thumbnail?.width, thumbnailHeight: thumbnail?.height, formats,
  };
}

function selectFormats(rawFormats: RawFormat[]): MediaFormat[] {
  const candidates = rawFormats.filter((format) => format.format_id !== undefined && format.vcodec && format.vcodec !== "none");
  const byHeight = new Map<string, MediaFormat>();
  for (const format of candidates) {
    const height = Number(format.height) || undefined;
    if (!height) continue;
    const normalized: MediaFormat = {
      id: String(format.format_id), label: `${height}p`, ext: (format.ext ?? "bin").toUpperCase(), width: format.width, height,
      hasAudio: Boolean(format.acodec && format.acodec !== "none"), size: format.filesize ?? format.filesize_approx, note: format.format_note,
    };
    const key = String(height);
    const current = byHeight.get(key);
    if (!current || score(normalized) > score(current)) byHeight.set(key, normalized);
  }
  return [...byHeight.values()].sort((a, b) => (b.height ?? 0) - (a.height ?? 0));
}

function score(format: MediaFormat) {
  return (format.hasAudio ? 100000 : 0) + (format.ext === "MP4" ? 10000 : 0) + (format.size ? 1 : 0);
}

export async function runYtDlp(url: string, flags: Record<string, unknown>, options?: Record<string, unknown>) {
  try {
    return await createYtDlp(resolveYtDlpBinary()).exec(url, flags as never, options as never);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "yt-dlp exited unexpectedly";
    if (/enoent|not found|cannot find/i.test(detail)) throw new Error("The local media engine is not installed correctly. Reinstall dependencies with pnpm install and try again.");
    throw error;
  }
}

function resolveYtDlpBinary() {
  const filename = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
  const localPath = join(process.cwd(), "node_modules", "yt-dlp-exec", "bin", filename);
  if (existsSync(localPath)) return localPath;
  throw new Error("The local media engine is not installed correctly. Reinstall dependencies with pnpm install and try again.");
}
