import { createReadStream } from "node:fs";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { Readable } from "node:stream";
import { getFfmpegPath } from "@/lib/ffmpeg/process";
import { acquireDownloadSlot } from "@/lib/downloads/limiter";
import { getMediaMode, resolveDirectMediaUrl, runYtDlp } from "@/lib/media/backend";
import { safeFilename, validateMediaUrl } from "@/lib/validation/url";

export const runtime = "nodejs";
export const maxDuration = 300;

type DownloadRequest = {
  url?: unknown;
  title?: unknown;
  formatId?: unknown;
  ext?: unknown;
  protocol?: unknown;
  hasAudio?: unknown;
  requiresFfmpeg?: unknown;
  type?: unknown;
  bitrate?: unknown;
};

export async function POST(request: Request) {
  let tempDirectory: string | undefined;
  let handedOff = false;
  let releaseSlot: (() => void) | undefined;
  try {
    const body = await request.json() as DownloadRequest;
    const source = validateMediaUrl(body.url);
    const type = body.type === "audio" ? "audio" : "video";
    const formatId = typeof body.formatId === "string" && /^[a-zA-Z0-9._+/-]+$/.test(body.formatId) ? body.formatId : undefined;
    const hasAudio = body.hasAudio === true;
    const hasExplicitFfmpegChoice = body.requiresFfmpeg === true || body.requiresFfmpeg === false;
    const requiresFfmpeg = type === "audio" || body.requiresFfmpeg === true || (!hasExplicitFfmpegChoice && type === "video" && !hasAudio);
    const protocol = typeof body.protocol === "string" ? body.protocol.toLowerCase() : "";
    const bitrate = typeof body.bitrate === "string" && /^(96|128|192|256|320)$/.test(body.bitrate) ? body.bitrate : "320";
    const title = typeof body.title === "string" ? body.title : type === "audio" ? "localdrop-audio" : "localdrop-video";
    const requestedExtension = safeExtension(body.ext, type === "audio" ? "mp3" : "mp4");
    releaseSlot = await acquireDownloadSlot();
    if (request.signal.aborted) throw new Error("Download cancelled.");

    if (getMediaMode() === "server") {
      if (type === "audio") throw new Error("Server mode supports direct media files only. MP3 conversion is available in local mode.");
      const directUrl = await resolveDirectMediaUrl(source.toString(), formatId);
      const proxyUrl = `/api/media-proxy?target=${encodeURIComponent(directUrl)}&referer=${encodeURIComponent(source.toString())}`;
      return Response.json({ direct: true, proxy: true, proxyUrl, filename: `${safeFilename(title)}.${requestedExtension}`, contentType: mimeFor(requestedExtension) }, { headers: { "Cache-Control": "no-store" } });
    }

    if (type === "video" && !requiresFfmpeg && formatId && isDirectProtocol(protocol)) {
      const directUrl = await resolveDirectMediaUrl(source.toString(), formatId);
      return Response.json({ direct: true, directUrl, filename: `${safeFilename(title)}.${requestedExtension}`, contentType: mimeFor(requestedExtension) }, { headers: { "Cache-Control": "no-store" } });
    }

    tempDirectory = await mkdtemp(join(tmpdir(), "localdrop-"));
    const outputBase = join(tempDirectory, "localdrop-output");
    const flags: Record<string, unknown> = {
      noPlaylist: true, noWarnings: true, noProgress: true, quiet: true, restrictFilenames: true,
      output: `${outputBase}.%(ext)s`,
    };
    if (requiresFfmpeg) flags.ffmpegLocation = await getFfmpegPath();
    if (type === "audio") {
      Object.assign(flags, { format: "bestaudio/best", extractAudio: true, audioFormat: "mp3", audioQuality: `${bitrate}K` });
    } else {
      Object.assign(flags, { format: formatId ? (requiresFfmpeg ? `${formatId}+bestaudio/${formatId}/best` : formatId) : requiresFfmpeg ? "bestvideo+bestaudio/best" : "best" });
      if (requiresFfmpeg) flags.mergeOutputFormat = "mp4";
    }
    await runYtDlp(source.toString(), flags, { signal: request.signal });
    const candidates = (await readdir(tempDirectory)).filter((file) => !file.endsWith(".part") && !file.endsWith(".ytdl"));
    if (!candidates.length) throw new Error("The source returned no downloadable file.");
    const filePath = join(tempDirectory, candidates[0]);
    const fileInfo = await stat(filePath);
    const extension = basename(filePath).split(".").pop() || (type === "audio" ? "mp3" : "mp4");
    const filename = `${safeFilename(title)}.${extension}`;
    if (process.env.VERCEL && fileInfo.size > 4_500_000) {
      throw new Error("This processed file is larger than Vercel's 4.5 MB function response limit. Choose a progressive direct format or use a host with file storage.");
    }
    const nodeStream = createReadStream(filePath);
    const cleanup = () => { void rm(tempDirectory as string, { recursive: true, force: true }); };
    nodeStream.once("close", cleanup);
    nodeStream.once("error", cleanup);
    handedOff = true;
    return new Response(Readable.toWeb(nodeStream) as ReadableStream, { headers: { "Content-Type": type === "audio" ? "audio/mpeg" : mimeFor(extension), "Content-Length": String(fileInfo.size), "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The local download could not be prepared.";
    return Response.json({ message, details: error instanceof Error ? error.stack : undefined }, { status: 422 });
  } finally {
    if (tempDirectory && !handedOff) await rm(tempDirectory, { recursive: true, force: true }).catch(() => undefined);
    releaseSlot?.();
  }
}

function mimeFor(extension: string) {
  return ({ mp4: "video/mp4", m4v: "video/mp4", webm: "video/webm", mkv: "video/x-matroska", mov: "video/quicktime", avi: "video/x-msvideo", ts: "video/mp2t" } as Record<string, string>)[extension.toLowerCase()] ?? "application/octet-stream";
}

function safeExtension(value: unknown, fallback: string) {
  return typeof value === "string" && /^[a-z0-9]{2,5}$/i.test(value) ? value.toLowerCase() : fallback;
}

function isDirectProtocol(protocol: string) {
  return protocol === "http" || protocol === "https";
}
