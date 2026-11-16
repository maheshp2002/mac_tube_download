import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { syncExtensionConfig } from "./sync-extension-config.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const extDir = path.join(root, "extension");
const publicDir = path.join(root, "public");
const zipOut = path.join(publicDir, "localdrop-extension.zip");

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. Sync extension configuration with current environment variable URL
syncExtensionConfig(root);

// 2. Ensure icons exist
execSync(`node "${path.join(root, "scripts/generate-extension-icons.mjs")}"`, { stdio: "inherit" });

// 3. Package extension into public/localdrop-extension.zip
if (process.platform === "win32") {
  try {
    execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${extDir}/*' -DestinationPath '${zipOut}' -Force"`, { stdio: "inherit" });
    console.log(`[Extension] Packaged extension to ${zipOut}`);
  } catch (err) {
    console.error("[Extension] Failed to package extension with PowerShell:", err);
  }
} else {
  try {
    execSync(`cd "${extDir}" && zip -r "${zipOut}" ./*`, { stdio: "inherit" });
    console.log(`[Extension] Packaged extension to ${zipOut}`);
  } catch (err) {
    console.error("[Extension] Failed to package extension with zip command:", err);
  }
}
