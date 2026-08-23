import { createReadStream } from "node:fs";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { Readable } from "node:stream";
import { getFfmpegPath } from "@/lib/ffmpeg/process";
import { acquireDownloadSlot } from "@/lib/downloads/limiter";
import { runYtDlp } from "@/lib/media/yt-dlp";
import { safeFilename, validateMediaUrl } from "@/lib/validation/url";

export const runtime = "nodejs";

type DownloadRequest = { url?: unknown; title?: unknown; formatId?: unknown; type?: unknown; bitrate?: unknown };

export async function POST(request: Request) {
  let tempDirectory: string | undefined;
  let handedOff = false;
  let releaseSlot: (() => void) | undefined;
  try {
    const body = await request.json() as DownloadRequest;
    const source = validateMediaUrl(body.url);
    const type = body.type === "audio" ? "audio" : "video";
    const formatId = typeof body.formatId === "string" && /^[a-zA-Z0-9._+/-]+$/.test(body.formatId) ? body.formatId : undefined;
    const bitrate = typeof body.bitrate === "string" && /^(96|128|192|256|320)$/.test(body.bitrate) ? body.bitrate : "320";
    releaseSlot = await acquireDownloadSlot();
    if (request.signal.aborted) throw new Error("Download cancelled.");
    const ffmpeg = await getFfmpegPath();
    tempDirectory = await mkdtemp(join(tmpdir(), "localdrop-"));
    const outputBase = join(tempDirectory, "localdrop-output");
    const flags: Record<string, unknown> = {
      noPlaylist: true, noWarnings: true, noProgress: true, quiet: true, restrictFilenames: true, ffmpegLocation: ffmpeg,
      output: `${outputBase}.%(ext)s`,
    };
    if (type === "audio") {
      Object.assign(flags, { format: "bestaudio/best", extractAudio: true, audioFormat: "mp3", audioQuality: `${bitrate}K` });
    } else {
      Object.assign(flags, { format: formatId ? `${formatId}+bestaudio/best` : "bestvideo+bestaudio/best", mergeOutputFormat: "mp4" });
    }
    await runYtDlp(source.toString(), flags, { signal: request.signal });
    const candidates = (await readdir(tempDirectory)).filter((file) => !file.endsWith(".part") && !file.endsWith(".ytdl"));
    if (!candidates.length) throw new Error("The source returned no downloadable file.");
    const filePath = join(tempDirectory, candidates[0]);
    const fileInfo = await stat(filePath);
    const extension = basename(filePath).split(".").pop() || (type === "audio" ? "mp3" : "mp4");
    const title = typeof body.title === "string" ? body.title : type === "audio" ? "localdrop-audio" : "localdrop-video";
    const filename = `${safeFilename(title)}.${extension}`;
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
  return ({ mp4: "video/mp4", webm: "video/webm", mkv: "video/x-matroska", mov: "video/quicktime" } as Record<string, string>)[extension.toLowerCase()] ?? "application/octet-stream";
}
