import { getMediaMode } from "./mode";
import { inspectNativeMedia, resolveNativeDirectMediaUrl } from "./native";
import { inspectMedia as inspectWithYtDlp, resolveDirectMediaUrl as resolveWithYtDlp, runYtDlp as runWithYtDlp } from "./yt-dlp";

export { getMediaMode };

export function inspectMedia(url: string) {
  return getMediaMode() === "server" ? inspectNativeMedia(url) : inspectWithYtDlp(url);
}

export function resolveDirectMediaUrl(url: string, formatId?: string) {
  if (getMediaMode() === "server") return resolveNativeDirectMediaUrl(url, formatId);
  if (!formatId) throw new Error("A local direct download requires a format selection.");
  return resolveWithYtDlp(url, formatId);
}

export function runYtDlp(url: string, flags: Record<string, unknown>, options?: Record<string, unknown>) {
  if (getMediaMode() === "server") throw new Error("yt-dlp is disabled in server mode. Use a direct media format instead.");
  return runWithYtDlp(url, flags, options);
}
