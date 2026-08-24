import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const providerServer = join(
  root,
  "vendor",
  "bgutil",
  "server",
  "build",
  "main.js"
);

if (!existsSync(providerServer)) {
  console.error(
    `[bgutil] Provider server not found: ${providerServer}`
  );

  process.exit(1);
}

console.log(
  `[bgutil] Starting PO-token provider: ${providerServer}`
);

const provider = spawn(
  process.execPath,
  [providerServer],
  {
    cwd: join(
      root,
      "vendor",
      "bgutil",
      "server"
    ),
    stdio: "inherit",
    env: {
      ...process.env,

      // Keep the provider local to this Render
      // instance. yt-dlp will access it internally.
      PORT: "4416",
    },
  }
);

provider.on("error", (error) => {
  console.error(
    "[bgutil] Failed to start provider:",
    error
  );

  process.exit(1);
});

provider.on("exit", (code, signal) => {
  if (code !== 0) {
    console.error(
      `[bgutil] Provider exited. code=${code} signal=${signal}`
    );

    process.exit(code ?? 1);
  }
});

console.log("[next] Starting Next.js...");

const next = spawn(
  "pnpm",
  ["exec", "next", "start"],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
    },
  }
);

next.on("error", (error) => {
  console.error(
    "[next] Failed to start:",
    error
  );

  provider.kill("SIGTERM");

  process.exit(1);
});

next.on("exit", (code, signal) => {
  provider.kill("SIGTERM");

  if (signal) {
    process.kill(
      process.pid,
      signal
    );
  }

  process.exit(code ?? 0);
});

function shutdown() {
  console.log(
    "[shutdown] Stopping services..."
  );

  next.kill("SIGTERM");
  provider.kill("SIGTERM");
}

process.on(
  "SIGTERM",
  shutdown
);

process.on(
  "SIGINT",
  shutdown
);