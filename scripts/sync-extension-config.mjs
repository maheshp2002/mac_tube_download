import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const configPath = path.join(root, "extension", "config.js");

export function resolveServerUrl(projectRoot = root) {
  const envVars = [
    "NEXT_PUBLIC_APP_URL",
    "APP_URL",
    "NEXT_PUBLIC_SERVER_URL",
    "SERVER_URL",
    "RENDER_EXTERNAL_URL",
    "VERCEL_PROJECT_PRODUCTION_URL",
    "VERCEL_URL",
  ];

  function isPlaceholder(u) {
    if (!u) return true;
    const lower = u.toLowerCase();
    return lower.includes("your-localdrop-server") || lower.includes("your-cobalt") || lower.includes("example.com");
  }

  // 1. Check process.env first
  for (const name of envVars) {
    let val = process.env[name]?.trim();
    if (val && !isPlaceholder(val)) {
      if (name.startsWith("VERCEL") && !val.startsWith("http://") && !val.startsWith("https://")) {
        val = `https://${val}`;
      }
      return val.replace(/\/+$/, "");
    }
  }

  // 2. Check local env files (.env.local, .env.production, .env)
  const envFiles = [".env.local", ".env.production", ".env"];
  for (const filename of envFiles) {
    const filePath = path.join(projectRoot, filename);
    if (!fs.existsSync(filePath)) continue;
    try {
      const contents = fs.readFileSync(filePath, "utf8");
      for (const name of envVars) {
        const regex = new RegExp(`^\\s*${name}\\s*=\\s*(?:"([^"]+)"|'([^']+)'|([^\\s#]+))`, "m");
        const match = contents.match(regex);
        if (match) {
          let val = (match[1] ?? match[2] ?? match[3]).trim();
          if (val && !isPlaceholder(val)) {
            if (name.startsWith("VERCEL") && !val.startsWith("http://") && !val.startsWith("https://")) {
              val = `https://${val}`;
            }
            return val.replace(/\/+$/, "");
          }
        }
      }
    } catch {
      // Optional env file
    }
  }

  return "http://localhost:3000";
}

export function syncExtensionConfig(projectRoot = root) {
  const serverUrl = resolveServerUrl(projectRoot);
  const targetFile = path.join(projectRoot, "extension", "config.js");

  const configContent = `// LocalDrop Extension Configuration
// Automatically generated from environment variables (e.g. NEXT_PUBLIC_APP_URL).
// To update, set NEXT_PUBLIC_APP_URL in your .env or .env.local file and run 'pnpm sync:extension' or 'pnpm dev'.
self.LOCALDROP_CONFIG = {
  defaultServerUrl: ${JSON.stringify(serverUrl)},
};
`;

  fs.writeFileSync(targetFile, configContent, "utf8");
  console.log(`[Extension Config] Synced default server URL: ${serverUrl}`);
  return serverUrl;
}

// Run directly if invoked via CLI
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  syncExtensionConfig();
}
