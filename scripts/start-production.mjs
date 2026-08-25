import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root =
  process.cwd();

/*
 * This controls ONLY YouTube.
 *
 * ytdlp:
 *   YouTube -> yt-dlp
 *   Other   -> yt-dlp
 *
 * cobalt:
 *   YouTube -> Cobalt
 *   Other   -> yt-dlp
 */
const youtubeDownloader =
  process.env.YOUTUBE_DOWNLOADER
    ?.trim()
    .toLowerCase() ?? "ytdlp";

let provider = null;

/*
 * Start bgutil only when yt-dlp
 * is being used for YouTube.
 *
 * IMPORTANT:
 * yt-dlp is still installed and used
 * for Instagram/TikTok/etc. when
 * YouTube uses Cobalt.
 */
if (
  youtubeDownloader ===
  "ytdlp"
) {
  const providerServer =
    join(
      root,
      "vendor",
      "bgutil",
      "server",
      "build",
      "main.js"
    );

  if (
    !existsSync(
      providerServer
    )
  ) {
    console.error(
      `[bgutil] Provider server not found: ${providerServer}`
    );

    process.exit(1);
  }

  console.log(
    "[media] YouTube downloader: yt-dlp"
  );

  console.log(
    `[bgutil] Starting provider: ${providerServer}`
  );

  provider =
    spawn(
      process.execPath,
      [
        providerServer,
        "--port",
        "4416",
      ],
      {
        cwd: join(
          root,
          "vendor",
          "bgutil",
          "server"
        ),

        stdio:
          "inherit",

        env: {
          ...process.env,
        },
      }
    );

  provider.on(
    "error",
    (error) => {
      console.error(
        "[bgutil] Failed to start provider:",
        error
      );

      process.exit(1);
    }
  );

  provider.on(
    "exit",
    (code, signal) => {
      if (code !== 0) {
        console.error(
          `[bgutil] Provider exited. code=${code} signal=${signal}`
        );

        process.exit(
          code ?? 1
        );
      }
    }
  );
} else if (
  youtubeDownloader ===
  "cobalt"
) {
  console.log(
    "[media] YouTube downloader: cobalt"
  );

  if (
    !process.env.COBALT_API_URL?.trim()
  ) {
    console.error(
      "[media] COBALT_API_URL is required when YOUTUBE_DOWNLOADER=cobalt."
    );

    process.exit(1);
  }

  console.log(
    `[media] Cobalt API: ${process.env.COBALT_API_URL}`
  );
} else {
  console.error(
    `[media] Unsupported YOUTUBE_DOWNLOADER="${youtubeDownloader}".`
  );

  console.error(
    '[media] Use "ytdlp" or "cobalt".'
  );

  process.exit(1);
}

console.log(
  "[next] Starting Next.js..."
);

const next =
  spawn(
    join(
      root,
      "node_modules",
      ".bin",
      "next"
    ),
    ["start"],
    {
      cwd: root,

      stdio:
        "inherit",

      env: {
        ...process.env,

        PORT:
          process.env.PORT ??
          "10000",
      },
    }
  );

next.on(
  "error",
  (error) => {
    console.error(
      "[next] Failed to start:",
      error
    );

    provider?.kill(
      "SIGTERM"
    );

    process.exit(1);
  }
);

next.on(
  "exit",
  (code, signal) => {
    provider?.kill(
      "SIGTERM"
    );

    if (signal) {
      process.kill(
        process.pid,
        signal
      );
    }

    process.exit(
      code ?? 0
    );
  }
);

function shutdown() {
  console.log(
    "[shutdown] Stopping services..."
  );

  next.kill(
    "SIGTERM"
  );

  provider?.kill(
    "SIGTERM"
  );
}

process.on(
  "SIGTERM",
  shutdown
);

process.on(
  "SIGINT",
  shutdown
);