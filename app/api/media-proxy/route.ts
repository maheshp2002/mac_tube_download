const MAX_RANGE_BYTES = 4_000_000;
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/146 Safari/537.36";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const target = requestUrl.searchParams.get("target");
  const referer = requestUrl.searchParams.get("referer");
  const range = request.headers.get("range");
  if (!target || !referer || !range) return Response.json({ message: "A ranged media request is required." }, { status: 400 });

  let targetUrl: URL;
  let refererUrl: URL;
  try {
    targetUrl = new URL(target);
    refererUrl = new URL(referer);
  } catch {
    return Response.json({ message: "The media proxy received an invalid source URL." }, { status: 400 });
  }
  if (!isHttpUrl(targetUrl) || !isHttpUrl(refererUrl)) return Response.json({ message: "Only HTTP and HTTPS media sources are supported." }, { status: 400 });

  const match = range.match(/^bytes=(\d+)-(\d*)$/i);
  if (!match) return Response.json({ message: "Only single byte ranges are supported." }, { status: 416 });
  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : start + MAX_RANGE_BYTES - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || requestedEnd < start || requestedEnd - start + 1 > MAX_RANGE_BYTES) {
    return Response.json({ message: "The requested media range is too large." }, { status: 416 });
  }

  const response = await fetch(targetUrl, {
    redirect: "follow",
    signal: AbortSignal.timeout(50_000),
    headers: {
      Accept: "*/*",
      Range: `bytes=${start}-${requestedEnd}`,
      Referer: refererUrl.toString(),
      "User-Agent": USER_AGENT,
    },
  }).catch((error) => {
    const message = error instanceof Error ? error.message : "The media source could not be reached.";
    return new Response(JSON.stringify({ message }), { status: 502, headers: { "Content-Type": "application/json" } });
  });

  if (!(response instanceof Response)) return response;
  if (!response.ok || response.status !== 206) {
    return Response.json({ message: `The media source did not honor ranged requests (HTTP ${response.status}).` }, { status: 502 });
  }

  const headers = new Headers();
  for (const name of ["accept-ranges", "content-length", "content-range", "content-type", "etag", "last-modified"]) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("Cache-Control", "no-store");
  return new Response(response.body, { status: 206, headers });
}

function isHttpUrl(url: URL) {
  return url.protocol === "http:" || url.protocol === "https:";
}
