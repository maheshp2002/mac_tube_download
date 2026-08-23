import type { MediaFormat, MediaMetadata } from "./types";

const REQUEST_TIMEOUT_MS = 20_000;
const BROWSER_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/146 Safari/537.36";
const DIRECT_EXTENSIONS = /\.(?:mp4|m4v|webm|mov|avi|mkv|mp3|m4a|aac|ogg|wav)(?:$|[?#])/i;
const AUDIO_EXTENSIONS = /\.(?:mp3|m4a|aac|ogg|wav)(?:$|[?#])/i;
const HLS_EXTENSION = /\.m3u8(?:$|[?#])/i;

type JsonObject = Record<string, unknown>;

type NativeFormat = MediaFormat & {
  url: string;
};

type NativeInspection = {
  metadata: MediaMetadata;
  formats: NativeFormat[];
};

type Candidate = {
  url: string;
  width?: number;
  height?: number;
  audioOnly?: boolean;
};

export async function inspectNativeMedia(url: string): Promise<MediaMetadata> {
  const inspection = await inspectNativeSource(url);
  return inspection.metadata;
}

export async function resolveNativeDirectMediaUrl(url: string, formatId?: string) {
  const inspection = await inspectNativeSource(url);
  const selected = formatId
    ? inspection.formats.find((format) => format.id === formatId)
    : inspection.formats.find((format) => format.audioOnly) ?? inspection.formats[0];
  if (!selected) throw new Error("The server extractor did not find a direct downloadable file.");
  return selected.url;
}

async function inspectNativeSource(url: string): Promise<NativeInspection> {
  const source = new URL(url);
  if (isDirectFileUrl(source.toString())) return inspectionFromDirectUrl(source.toString());

  const response = await fetch(source, {
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Referer: `${source.origin}/`,
      "User-Agent": BROWSER_USER_AGENT,
    },
  });
  if (!response.ok) throw new Error(`The server extractor could not read this source (HTTP ${response.status}).`);

  const html = await response.text();
  const initials = parseAssignedJson(html, "window.initials");
  const jsonLd = parseJsonLd(html);
  const candidates: Candidate[] = [];
  const pageUrl = response.url || source.toString();

  for (const tag of html.match(/<(?:video|audio|source)\b[^>]*>/gi) ?? []) {
    const tagName = tag.match(/^<([a-z]+)/i)?.[1]?.toLowerCase();
    const rawUrl = readAttribute(tag, "src") ?? readAttribute(tag, "data-src");
    if (!rawUrl) continue;
    addCandidate(candidates, rawUrl, pageUrl, {
      width: numberAttribute(tag, "width"),
      height: numberAttribute(tag, "height"),
      audioOnly: tagName === "audio",
    }, true);
  }

  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (readAttribute(tag, "property") ?? readAttribute(tag, "name") ?? "").toLowerCase();
    if (!new Set(["og:video", "og:video:url", "og:video:secure_url", "twitter:player:stream"]).has(key)) continue;
    const rawUrl = readAttribute(tag, "content");
    if (rawUrl) addCandidate(candidates, rawUrl, pageUrl);
  }

  for (const value of jsonLd) collectJsonLdCandidates(value, candidates, pageUrl);

  const videoModel = asObject(initials?.videoModel);

  const formats = toNativeFormats(candidates);
  if (!formats.length) {
    throw new Error("Server mode could not find a direct media file in this page. This source may require a site-specific extractor or login.");
  }

  const jsonLdObject = findJsonLdObject(jsonLd);
  const title = firstString(
    videoModel?.title,
    jsonLdObject?.name,
    jsonLdObject?.headline,
    readMeta(html, ["og:title", "twitter:title"]),
    cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]),
    filenameTitle(source.pathname),
  ) ?? "Untitled media";
  const authorModel = asObject(videoModel?.author);
  const author = firstString(authorModel?.name, jsonLdAuthor(jsonLdObject), readMeta(html, ["author"]));
  const thumbnail = firstString(
    videoModel?.thumbURL,
    jsonLdImage(jsonLdObject),
    readMeta(html, ["og:image", "twitter:image"]),
  );
  const duration = numberValue(videoModel?.duration) ?? parseDuration(firstString(jsonLdObject?.duration, readMeta(html, ["duration"])));
  const id = firstString(videoModel?.id, videoModel?.idHashSlug, pathnameId(source.pathname)) ?? source.toString();

  return {
    metadata: {
      id,
      sourceUrl: url,
      title,
      author,
      duration,
      thumbnail,
      formats: formats.map(toPublicFormat),
    },
    formats,
  };
}

function inspectionFromDirectUrl(url: string): NativeInspection {
  const format = makeFormat({ url, height: heightFromText(url), audioOnly: AUDIO_EXTENSIONS.test(url) }, 0);
  const title = filenameTitle(new URL(url).pathname) ?? "media";
  return {
    metadata: { id: url, sourceUrl: url, title, formats: [toPublicFormat(format)] },
    formats: [format],
  };
}

function toPublicFormat(format: NativeFormat): MediaFormat {
  const publicFormat: Omit<NativeFormat, "url"> & { url?: string } = { ...format };
  delete publicFormat.url;
  return publicFormat;
}

function toNativeFormats(candidates: Candidate[]) {
  const seen = new Set<string>();
  return candidates
    .filter((candidate) => {
      if (seen.has(candidate.url)) return false;
      seen.add(candidate.url);
      return true;
    })
    .sort((left, right) => Number(Boolean(left.audioOnly)) - Number(Boolean(right.audioOnly)) || (right.height ?? 0) - (left.height ?? 0))
    .map((candidate, index) => makeFormat(candidate, index));
}

function makeFormat(candidate: Candidate, index: number): NativeFormat {
  const audioOnly = Boolean(candidate.audioOnly) || AUDIO_EXTENSIONS.test(candidate.url);
  const height = candidate.height ?? heightFromText(candidate.url);
  const ext = extensionFromUrl(candidate.url);
  return {
    id: `native-${index}`,
    url: candidate.url,
    label: audioOnly ? "Audio" : height ? `${height}p` : "Original",
    ext: ext.toUpperCase(),
    protocol: new URL(candidate.url).protocol.replace(":", ""),
    width: candidate.width,
    height,
    hasAudio: !audioOnly,
    audioOnly,
    requiresFfmpeg: false,
  };
}

function addCandidate(target: Candidate[], rawUrl: string, baseUrl: string, hints: Omit<Candidate, "url"> = {}, allowUnknownExtension = false) {
  const decoded = decodeHtmlEntities(rawUrl.trim());
  if (!/^(?:https?:)?\/\//i.test(decoded) && !decoded.startsWith("/")) return;
  let parsed: URL;
  try {
    parsed = new URL(decoded, baseUrl);
  } catch {
    return;
  }
  if (!isHttpUrl(parsed) || HLS_EXTENSION.test(parsed.toString())) return;
  if (!allowUnknownExtension && !DIRECT_EXTENSIONS.test(parsed.toString())) return;
  if (parsed.toString() === baseUrl || parsed.toString().replace(/#.*$/, "") === baseUrl.replace(/#.*$/, "")) return;
  target.push({ ...hints, url: parsed.toString() });
}

function collectJsonLdCandidates(value: unknown, target: Candidate[], baseUrl: string, key?: string) {
  if (typeof value === "string") {
    if (["contenturl", "content_url", "videourl", "video_url", "url"].includes(key?.toLowerCase() ?? "")) {
      addCandidate(target, value, baseUrl);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectJsonLdCandidates(item, target, baseUrl, key);
    return;
  }
  const object = asObject(value);
  if (!object) return;
  for (const [childKey, childValue] of Object.entries(object)) collectJsonLdCandidates(childValue, target, baseUrl, childKey);
}

function parseAssignedJson(html: string, marker: string) {
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return undefined;
  const objectStart = html.indexOf("{", html.indexOf("=", markerIndex));
  if (objectStart < 0) return undefined;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = objectStart; index < html.length; index += 1) {
    const character = html[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{") depth += 1;
    else if (character === "}" && --depth === 0) {
      try { return JSON.parse(html.slice(objectStart, index + 1)) as JsonObject; } catch { return undefined; }
    }
  }
  return undefined;
}

function parseJsonLd(html: string) {
  const values: unknown[] = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { values.push(JSON.parse(decodeHtmlEntities(match[1]))); } catch { /* Ignore malformed JSON-LD. */ }
  }
  return values;
}

function findJsonLdObject(values: unknown[]) {
  for (const value of values) {
    const found = findObjectWithKey(value, "name") ?? findObjectWithKey(value, "headline");
    if (found) return found;
  }
  return undefined;
}

function findObjectWithKey(value: unknown, key: string): JsonObject | undefined {
  if (Array.isArray(value)) {
    for (const item of value) { const found = findObjectWithKey(item, key); if (found) return found; }
    return undefined;
  }
  const object = asObject(value);
  if (!object) return undefined;
  if (key in object) return object;
  for (const child of Object.values(object)) { const found = findObjectWithKey(child, key); if (found) return found; }
  return undefined;
}

function readMeta(html: string, keys: string[]) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (readAttribute(tag, "property") ?? readAttribute(tag, "name") ?? "").toLowerCase();
    if (keys.map((item) => item.toLowerCase()).includes(key)) return cleanText(readAttribute(tag, "content"));
  }
  return undefined;
}

function readAttribute(tag: string, name: string) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match ? decodeHtmlEntities(match[2]) : undefined;
}

function numberAttribute(tag: string, name: string) {
  const value = readAttribute(tag, name);
  return value ? Number(value) || undefined : undefined;
}

function asObject(value: unknown): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined;
}

function firstString(...values: unknown[]) {
  return values.map((value) => typeof value === "string" ? cleanText(value) : typeof value === "number" ? String(value) : undefined).find(Boolean);
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && Number.isFinite(Number(value)) ? Number(value) : undefined;
}

function jsonLdAuthor(value: JsonObject | undefined) {
  const author = asObject(value?.author);
  return firstString(author?.name, value?.author);
}

function jsonLdImage(value: JsonObject | undefined) {
  const image = value?.image ?? value?.thumbnailUrl;
  return typeof image === "string" ? image : firstString(asObject(image)?.url, asObject(image)?.contentUrl);
}

function parseDuration(value?: string) {
  if (!value) return undefined;
  const iso = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/i);
  if (iso) return Number(iso[1] ?? 0) * 3600 + Number(iso[2] ?? 0) * 60 + Number(iso[3] ?? 0);
  const parts = value.split(":").map(Number);
  if (parts.every(Number.isFinite)) return parts.reduce((total, part) => total * 60 + part, 0);
  return undefined;
}

function heightFromText(value: string) {
  return Number(value.match(/(?:^|[^\d])(\d{3,4})p(?:[^\d]|$)/i)?.[1]) || undefined;
}

function extensionFromUrl(value: string) {
  return value.match(/\.([a-z0-9]{2,5})(?:$|[?#])/i)?.[1] ?? "mp4";
}

function isDirectFileUrl(value: string) {
  return DIRECT_EXTENSIONS.test(value) && !HLS_EXTENSION.test(value);
}

function isHttpUrl(value: URL) {
  return value.protocol === "http:" || value.protocol === "https:";
}

function pathnameId(pathname: string) {
  return pathname.match(/-([A-Za-z0-9]+)\/?$/)?.[1];
}

function filenameTitle(pathname: string) {
  const file = pathname.split("/").filter(Boolean).pop();
  if (!file) return undefined;
  return decodeURIComponent(file).replace(/\.(?:mp4|m4v|webm|mov|avi|mkv|mp3|m4a|aac|ogg|wav)$/i, "").replace(/[-_]+/g, " ");
}

function cleanText(value?: string) {
  if (!value) return undefined;
  return decodeHtmlEntities(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || undefined;
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x2F;|&#47;/gi, "/");
}
