import { chmod, mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const platformAsset = getPlatformAsset();
const binaryName = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
const binaryPath = join(projectRoot, "vendor", "yt-dlp", binaryName);

if (await isUsableBinary(binaryPath)) {
  console.log(`[media] Standalone yt-dlp is ready at ${binaryPath}.`);
  process.exit(0);
}

const assetUrl = await resolveAssetUrl(platformAsset);
const binaryResponse = await fetch(assetUrl, {
  headers: { "User-Agent": "localdrop-build" },
});
if (!binaryResponse.ok) {
  throw new Error(`[media] Could not download ${platformAsset} (${binaryResponse.status}).`);
}

const binary = Buffer.from(await binaryResponse.arrayBuffer());
if (binary.length <= 1_000_000) {
  throw new Error(`[media] Downloaded ${platformAsset} is unexpectedly small (${binary.length} bytes).`);
}

await mkdir(dirname(binaryPath), { recursive: true });
await writeFile(binaryPath, binary, { mode: 0o755 });
if (process.platform !== "win32") await chmod(binaryPath, 0o755);
console.log(`[media] Installed standalone ${platformAsset} at ${binaryPath}.`);

async function resolveAssetUrl(assetName) {
  const directAssetUrl = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${encodeURIComponent(assetName)}`;

  try {
    const releaseResponse = await fetch("https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest", {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "localdrop-build" },
    });

    if (releaseResponse.ok) {
      const release = await releaseResponse.json();
      const asset = Array.isArray(release.assets)
        ? release.assets.find((item) => item?.name === assetName)
        : undefined;
      if (asset?.browser_download_url) return asset.browser_download_url;
      console.warn(`[media] The latest release did not list ${assetName}; using the direct release URL.`);
    } else {
      console.warn(`[media] Release API unavailable (${releaseResponse.status}); using the direct release URL.`);
    }
  } catch (error) {
    console.warn(`[media] Could not inspect the release API; using the direct release URL.`, error);
  }

  return directAssetUrl;
}

function getPlatformAsset() {
  if (process.platform === "linux" && process.arch === "x64") return "yt-dlp_linux";
  if (process.platform === "linux" && process.arch === "arm64") return "yt-dlp_linux_aarch64";
  if (process.platform === "darwin") return "yt-dlp_macos";
  if (process.platform === "win32" && process.arch === "x64") return "yt-dlp.exe";
  throw new Error(`[media] No standalone yt-dlp binary is configured for ${process.platform}/${process.arch}.`);
}

async function isUsableBinary(path) {
  try {
    const details = await stat(path);
    return details.isFile() && details.size > 1_000_000;
  } catch {
    return false;
  }
}
