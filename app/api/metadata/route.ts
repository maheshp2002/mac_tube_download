import { inspectMedia } from "@/lib/media/backend";
import { validateMediaUrl } from "@/lib/validation/url";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { url?: unknown };
    const url = validateMediaUrl(body.url);
    const media = await inspectMedia(url.toString());
    return Response.json({ media });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The source could not be inspected.";
    return Response.json({ message, details: error instanceof Error ? error.stack : undefined }, { status: 422 });
  }
}
