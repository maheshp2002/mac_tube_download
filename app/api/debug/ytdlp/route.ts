import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import os from "os";

const execFileAsync = promisify(execFile);

const TEST_URL = "https://www.youtube.com/shorts/Yf6IhvT253I";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();

  const result: Record<string, any> = {
    testUrl: TEST_URL,
    timestamp: new Date().toISOString(),

    system: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      hostname: os.hostname(),
      cwd: process.cwd(),
    },

    render: {
      RENDER: process.env.RENDER,
      RENDER_SERVICE_NAME: process.env.RENDER_SERVICE_NAME,
      RENDER_INSTANCE_ID: process.env.RENDER_INSTANCE_ID,
    },
  };

  // --------------------------------------------------
  // yt-dlp executable
  // --------------------------------------------------

  try {
    const r = await execFileAsync(
      "sh",
      ["-c", "command -v yt-dlp || which yt-dlp || true"],
      { timeout: 10_000 }
    );

    result.ytdlp = {
      path: r.stdout.trim(),
      stderr: r.stderr.trim(),
    };
  } catch (error: any) {
    result.ytdlp = {
      error: error?.message,
      code: error?.code,
      stdout: error?.stdout,
      stderr: error?.stderr,
    };
  }

  // --------------------------------------------------
  // yt-dlp version
  // --------------------------------------------------

  try {
    const r = await execFileAsync(
      "yt-dlp",
      ["--version"],
      { timeout: 10_000 }
    );

    result.ytdlpVersion = {
      version: r.stdout.trim(),
      stderr: r.stderr.trim(),
    };
  } catch (error: any) {
    result.ytdlpVersion = {
      error: error?.message,
      code: error?.code,
      stdout: error?.stdout,
      stderr: error?.stderr,
    };
  }

  // --------------------------------------------------
  // yt-dlp verbose extraction
  // --------------------------------------------------

  try {
    const r = await execFileAsync(
      "yt-dlp",
      [
        "--verbose",
        "--no-warnings",
        "--simulate",
        "--dump-single-json",
        "--no-playlist",
        TEST_URL,
      ],
      {
        timeout: 120_000,
        maxBuffer: 30 * 1024 * 1024,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: "1",
        },
      }
    );

    result.extraction = {
      success: true,
      exitCode: 0,
      stdout: r.stdout,
      stderr: r.stderr,
    };
  } catch (error: any) {
    result.extraction = {
      success: false,
      exitCode: error?.code,
      signal: error?.signal,
      killed: error?.killed,
      message: error?.message,
      stdout: error?.stdout ?? "",
      stderr: error?.stderr ?? "",
    };
  }

  result.durationMs = Date.now() - start;

  return NextResponse.json(result, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}