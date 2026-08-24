import { NextResponse } from "next/server";
import os from "os";
import { runYtDlp } from "@/lib/media/backend";

const TEST_URL =
  "https://www.youtube.com/shorts/Yf6IhvT253I";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();

  const result: Record<string, unknown> = {
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
      RENDER_SERVICE_NAME:
        process.env.RENDER_SERVICE_NAME,
      RENDER_INSTANCE_ID:
        process.env.RENDER_INSTANCE_ID,
    },

    extraction: null,
  };

  // --------------------------------------------------
  // yt-dlp extraction
  //
  // IMPORTANT:
  // This uses the EXACT same runYtDlp() function
  // used by the real application.
  //
  // Therefore it also uses:
  //   --js-runtimes node
  //   --extractor-args youtube:player-client=android,web
  //
  // from YTDLP_BASE_FLAGS in yt-dlp.ts.
  // --------------------------------------------------

  try {
    const r = await runYtDlp(TEST_URL, {
      verbose: true,
      noWarnings: true,
      simulate: true,
      dumpSingleJson: true,
      noPlaylist: true,
    });

    result.extraction = {
      success: true,
      exitCode: 0,
      stdout: r.stdout,
      stderr: r.stderr,
    };
  } catch (error: unknown) {
    const err = error as {
      message?: string;
      code?: string | number;
      signal?: string | null;
      killed?: boolean;
      stdout?: string;
      stderr?: string;
    };

    result.extraction = {
      success: false,
      exitCode: err.code ?? null,
      signal: err.signal ?? null,
      killed: err.killed ?? false,
      message:
        err.message ??
        "yt-dlp extraction failed.",
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
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