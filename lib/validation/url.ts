export function validateMediaUrl(value: unknown): URL {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("A media URL is required.");
  }

  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error("Invalid URL. Include the full address starting with https://.");
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
    throw new Error("Unsupported URL. Only HTTP and HTTPS media sources are supported.");
  }

  return parsed;
}

export function safeFilename(value: string, fallback = "localdrop-download") {
  const clean = value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return (clean || fallback).slice(0, 110);
}
