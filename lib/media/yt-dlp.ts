import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { MediaFormat, MediaMetadata } from "./types";

type RawFormat = {
  format_id?: string | number;
  url?: string;
  ext?: string;
  protocol?: string;
  width?: number;
  height?: number;
  vcodec?: string;
  acodec?: string;
  video_ext?: string;
  audio_ext?: string;
  abr?: number;
  tbr?: number;
  filesize?: number;
  filesize_approx?: number;
  format_note?: string;
  resolution?: string;
};

type RawThumbnail = {
  url?: string;
  width?: number;
  height?: number;
};

type RawInfo = {
  _type?: string;
  id?: string | number;
  url?: string;
  ext?: string;
  protocol?: string;
  width?: number;
  height?: number;
  vcodec?: string;
  acodec?: string;
  video_ext?: string;
  audio_ext?: string;
  abr?: number;
  filesize?: number;
  webpage_url?: string;
  title?: string;
  uploader?: string;
  channel?: string;
  duration?: number;
  thumbnail?: string;
  thumbnails?: RawThumbnail[];
  formats?: RawFormat[];
};

/**
 * Common yt-dlp configuration.
 *
 * Node is required for the current YouTube EJS challenge system.
 * Render already provides Node 24.x.
 */
const YTDLP_BASE_FLAGS = {
  jsRuntimes: "node",
  extractorArgs:
    "youtube:player-client=mweb;youtubepot-bgutilhttp:base_url=http://127.0.0.1:4416",
};

export async function inspectMedia(url: string): Promise<MediaMetadata> {
  const result = await inspectWithFallback(url);

  const raw = JSON.parse(result.stdout) as RawInfo;

  const rawFormats =
    Array.isArray(raw.formats) && raw.formats.length
      ? raw.formats
      : raw.url
        ? [
            {
              format_id: "0",
              url: raw.url,
              ext: raw.ext,
              protocol: raw.protocol,
              width: raw.width,
              height: raw.height,
              vcodec: raw.vcodec,
              acodec: raw.acodec,
              video_ext: raw.video_ext,
              audio_ext: raw.audio_ext,
              abr: raw.abr,
              filesize: raw.filesize,
            },
          ]
        : [];

  const formats = selectFormats(rawFormats);

  if (!formats.length) {
    throw new Error(
      "Media unavailable. The source did not expose a downloadable video or audio stream."
    );
  }

  const thumbnails = (raw.thumbnails ?? [])
    .filter((item) => item.url)
    .sort(
      (a, b) =>
        (b.width ?? 0) * (b.height ?? 0) -
        (a.width ?? 0) * (a.height ?? 0)
    );

  const thumbnail = thumbnails[0];

  return {
    id: String(raw.id ?? url),
    sourceUrl: raw.webpage_url ?? url,
    title: raw.title ?? "Untitled media",
    author: raw.uploader ?? raw.channel,
    duration: raw.duration,
    thumbnail: thumbnail?.url ?? raw.thumbnail,
    thumbnailWidth: thumbnail?.width,
    thumbnailHeight: thumbnail?.height,
    formats,
  };
}

function selectFormats(rawFormats: RawFormat[]): MediaFormat[] {
  const candidates = rawFormats.filter(
    (format) =>
      format.format_id !== undefined &&
      hasMedia(format)
  );

  const byHeight = new Map<string, MediaFormat>();

  for (const format of candidates) {
    const height = Number(format.height) || undefined;

    const hasVideo = hasVideoStream(format);
    const hasAudio = hasAudioStream(format);
    const audioOnly = !hasVideo && hasAudio;

    if (!height) continue;

    const normalized: MediaFormat = {
      id: String(format.format_id),
      label: `${height}p`,
      ext: (format.ext ?? "bin").toUpperCase(),
      protocol: format.protocol,
      width: format.width,
      height,
      hasAudio,
      audioOnly,
      requiresFfmpeg: requiresFfmpeg(
        format,
        audioOnly,
        hasAudio
      ),
      size:
        format.filesize ??
        format.filesize_approx,
      note: format.format_note,
    };

    const key = audioOnly
      ? `audio-${format.format_id}`
      : `video-${height}`;

    const current = byHeight.get(key);

    if (
      !current ||
      score(normalized) > score(current)
    ) {
      byHeight.set(key, normalized);
    }
  }

  for (const format of candidates) {
    const hasVideo = hasVideoStream(format);
    const hasAudio = hasAudioStream(format);
    const audioOnly = !hasVideo && hasAudio;

    if (
      format.height ||
      (!hasVideo && !hasAudio)
    ) {
      continue;
    }

    const normalized: MediaFormat = {
      id: String(format.format_id),
      label: audioOnly
        ? `${Math.round(
            format.abr ??
              format.tbr ??
              0
          )} kbps`
        : "Original",
      ext: (format.ext ?? "bin").toUpperCase(),
      protocol: format.protocol,
      width: format.width,
      height: format.height,
      hasAudio,
      audioOnly,
      requiresFfmpeg: requiresFfmpeg(
        format,
        audioOnly,
        hasAudio
      ),
      size:
        format.filesize ??
        format.filesize_approx,
      note: format.format_note,
    };

    const key = audioOnly
      ? `audio-${format.format_id}`
      : `video-original-${format.ext ?? format.format_id}`;

    const current = byHeight.get(key);

    if (
      !current ||
      score(normalized) > score(current)
    ) {
      byHeight.set(key, normalized);
    }
  }

  return [...byHeight.values()].sort(
    (a, b) => {
      if (
        Boolean(a.audioOnly) !==
        Boolean(b.audioOnly)
      ) {
        return a.audioOnly ? 1 : -1;
      }

      return (
        (b.height ?? 0) -
        (a.height ?? 0)
      );
    }
  );
}

function score(format: MediaFormat) {
  return (
    (format.hasAudio ? 100000 : 0) +
    (format.ext === "MP4" ? 10000 : 0) +
    (format.size ? 1 : 0)
  );
}

function hasMedia(format: RawFormat) {
  return (
    hasVideoStream(format) ||
    hasAudioStream(format)
  );
}

function hasVideoStream(format: RawFormat) {
  return Boolean(
    (format.vcodec &&
      format.vcodec !== "none") ||
      (format.video_ext &&
        format.video_ext !== "none")
  );
}

function hasAudioStream(format: RawFormat) {
  return Boolean(
    (format.acodec &&
      format.acodec !== "none") ||
      (format.audio_ext &&
        format.audio_ext !== "none")
  );
}

function requiresFfmpeg(
  format: RawFormat,
  audioOnly: boolean,
  hasAudio: boolean
) {
  const opaqueDirectFile =
    isDirectProtocol(format.protocol) &&
    !format.vcodec &&
    !format.acodec &&
    Boolean(format.video_ext);

  return (
    !audioOnly &&
    !opaqueDirectFile &&
    (!hasAudio ||
      !isDirectProtocol(format.protocol))
  );
}

function isDirectProtocol(protocol?: string) {
  return (
    protocol === "http" ||
    protocol === "https"
  );
}

/**
 * Inspect media metadata.
 *
 * Node/EJS is enabled through YTDLP_BASE_FLAGS.
 */
async function inspectWithFallback(url: string) {
  const flags = {
    ...YTDLP_BASE_FLAGS,

    dumpSingleJson: true,
    noWarnings: true,
    noPlaylist: true,
    skipDownload: true,
    preferFreeFormats: true,
  };

  try {
    return await runYtDlp(
      url,
      flags
    );
  } catch (firstError) {
    try {
      return await runYtDlp(
        url,
        {
          ...flags,
          forceGenericExtractor: true,
        }
      );
    } catch (fallbackError) {
      const firstMessage =
        firstError instanceof Error
          ? firstError.message
          : "The source extractor failed.";

      const fallbackMessage =
        fallbackError instanceof Error
          ? fallbackError.message
          : "The generic extractor failed.";

      throw new Error(
        `${firstMessage} Generic fallback: ${fallbackMessage}`
      );
    }
  }
}

/**
 * Resolve a selected format into a direct media URL.
 *
 * Node/EJS is also enabled here through YTDLP_BASE_FLAGS.
 */
export async function resolveDirectMediaUrl(
  url: string,
  formatId: string
) {
  const result = await runYtDlp(
    url,
    {
      ...YTDLP_BASE_FLAGS,

      getUrl: true,
      noWarnings: true,
      noPlaylist: true,
      noProgress: true,
      quiet: true,
      format: formatId,
    }
  );

  const urls = result.stdout
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);

  if (urls.length !== 1) {
    throw new Error(
      "This source returned multiple stream URLs and needs server-side processing."
    );
  }

  const resolved = new URL(urls[0]);

  if (
    !isDirectProtocol(
      resolved.protocol.replace(":", "")
    )
  ) {
    throw new Error(
      "The source did not return a direct HTTP stream."
    );
  }

  return resolved.toString();
}

/**
 * Execute yt-dlp.
 *
 * All callers pass their own flags, while YTDLP_BASE_FLAGS
 * ensures the required JS runtime is configured.
 */
export async function runYtDlp(
  url: string,
  flags: Record<string, unknown>,
  options?: Record<string, unknown>
) {
  const binary = resolveYtDlpBinary();

  const args = [
    ...flagArguments({
      ...YTDLP_BASE_FLAGS,
      ...flags,
    }),
    url,
  ];

  const signal = isAbortSignal(
    options?.signal
  )
    ? options.signal
    : undefined;

  return new Promise<{
    stdout: string;
    stderr: string;
  }>((resolve, reject) => {
    const child = spawn(
      binary,
      args,
      {
        stdio: [
          "ignore",
          "pipe",
          "pipe",
        ],
        signal,
      }
    );

    let stdout = "";
    let stderr = "";

    child.stdout.on(
      "data",
      (chunk: Buffer) => {
        stdout += chunk.toString();
      }
    );

    child.stderr.on(
      "data",
      (chunk: Buffer) => {
        stderr += chunk.toString();
      }
    );

    child.on(
      "error",
      (error) => {
        if (
          (error as NodeJS.ErrnoException)
            .code === "ENOENT"
        ) {
          return reject(
            new Error(
              "The standalone yt-dlp binary is missing. Run pnpm install and try again."
            )
          );
        }

        reject(error);
      }
    );

    child.on(
      "close",
      (code) => {
        if (signal?.aborted) {
          return reject(
            new Error("Download cancelled.")
          );
        }

        if (code === 0) {
          return resolve({
            stdout,
            stderr,
          });
        }

        reject(
          new Error(
            stderr.trim() ||
              `yt-dlp exited with code ${
                code ?? "unknown"
              }.`
          )
        );
      }
    );
  });
}

function resolveYtDlpBinary() {
  const filename =
    process.platform === "win32"
      ? "yt-dlp.exe"
      : "yt-dlp";

  const localPath = join(
    process.cwd(),
    "vendor",
    "yt-dlp",
    filename
  );

  if (existsSync(localPath)) {
    return localPath;
  }

  throw new Error(
    "The standalone yt-dlp binary is missing. Run pnpm install and try again."
  );
}

function flagArguments(
  flags: Record<string, unknown>
) {
  const args: string[] = [];

  for (
    const [key, value] of Object.entries(flags)
  ) {
    if (
      value === undefined ||
      value === null ||
      value === false
    ) {
      continue;
    }

    const flag = `--${key.replace(
      /[A-Z]/g,
      (letter) =>
        `-${letter.toLowerCase()}`
    )}`;

    if (value === true) {
      args.push(flag);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        args.push(
          flag,
          String(item)
        );
      }
    } else {
      args.push(
        flag,
        String(value)
      );
    }
  }

  return args;
}

function isAbortSignal(
  value: unknown
): value is AbortSignal {
  return (
    typeof value === "object" &&
    value !== null &&
    "aborted" in value &&
    "addEventListener" in value
  );
}