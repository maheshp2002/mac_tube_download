export type MediaMode = "local" | "server";

export function getMediaMode(): MediaMode {
  const configured = process.env.MEDIA_MODE?.trim().toLowerCase();
  if (configured === "local" || configured === "server") return configured;
  return process.env.VERCEL ? "server" : "local";
}
