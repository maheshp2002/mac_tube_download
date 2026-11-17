import { inspectMedia } from "@/lib/media/backend";
import { validateMediaUrl } from "@/lib/validation/url";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, HEAD",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function GET() {
  return Response.json({ status: "ok" }, { headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { url?: unknown };
    const url = validateMediaUrl(body.url);
    const media = await inspectMedia(url.toString());
    return Response.json({ media }, { headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The source could not be inspected.";
    return Response.json(
      { message, details: error instanceof Error ? error.stack : undefined },
      { status: 422, headers: corsHeaders }
    );
  }
}
