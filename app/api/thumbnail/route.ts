import { inspectMedia } from "@/lib/media/backend";
import { validateMediaUrl, safeFilename } from "@/lib/validation/url";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { url?: unknown };
    const source = validateMediaUrl(body.url);
    const media = await inspectMedia(source.toString());
    if (!media.thumbnail) throw new Error("Thumbnail unavailable. This source did not provide an image.");
    const response = await fetch(media.thumbnail, { headers: { Referer: source.toString(), "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok || !response.body) throw new Error("Thumbnail download failed. The source image could not be reached.");
    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    const extension = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    return new Response(response.body, { headers: { "Content-Type": contentType, "Content-Disposition": `attachment; filename="${safeFilename(media.title)}.${extension}"`, "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The thumbnail could not be downloaded.";
    return Response.json({ message, details: error instanceof Error ? error.stack : undefined }, { status: 422 });
  }
}
