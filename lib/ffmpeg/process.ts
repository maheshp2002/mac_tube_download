import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import ffmpegPackagePath from "ffmpeg-static";

export async function getFfmpegPath() {
  const filename = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  const localPath = join(process.cwd(), "node_modules", "ffmpeg-static", filename);
  const resolvedPath = existsSync(localPath) ? localPath : ffmpegPackagePath;
  if (!resolvedPath) throw new Error("FFmpeg binary is unavailable for this platform.");
  try { await access(resolvedPath); } catch { throw new Error("FFmpeg is not installed. Run pnpm install to download the local binary."); }
  return resolvedPath;
}

export async function runFfmpeg(args: string[], signal?: AbortSignal) {
  const binary = await getFfmpegPath();
  return new Promise<void>((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    const abort = () => child.kill("SIGTERM");
    signal?.addEventListener("abort", abort, { once: true });
    child.on("error", reject);
    child.on("close", (code) => { signal?.removeEventListener("abort", abort); if (signal?.aborted) return reject(new Error("Download cancelled.")); if (code === 0) return resolve(); reject(new Error(`FFmpeg processing failed${stderr ? `: ${stderr.slice(-500)}` : "."}`)); });
  });
}
