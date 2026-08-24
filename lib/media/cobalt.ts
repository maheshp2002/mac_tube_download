import type { MediaFormat, MediaMetadata } from "./types";

type CobaltResponse =
  | {
      status: "tunnel" | "redirect";
      url: string;
      filename?: string;
    }
  | {
      status: "local-processing";
      type: string;
      service: string;
      tunnel: string[];
      output?: {
        type?: string;
        filename?: string;
        metadata?: Record<string, unknown>;
      };
    }
  | {
      status: "picker";
      picker?: Array<{
        type?: string;
        url?: string;
        thumb?: string;
      }>;
    }
  | {
      status: "error";
      error?: {
        code?: string;
        context?: Record<string, unknown>;
      };
    };

type OEmbedResponse = {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
  author_url?: string;
};

const VIDEO_QUALITIES = [
  "4320",
  "2160",
  "1440",
  "1080",
  "720",
  "480",
  "360",
  "240",
  "144",
  "max",
] as const;

function getCobaltUrl() {
  const value = process.env.COBALT_API_URL?.trim();

  if (!value) {
    throw new Error(
      "COBALT_API_URL is not configured. Set it to your Cobalt API instance."
    );
  }

  return value.replace(/\/+$/, "");
}

async function cobaltRequest(
  body: Record<string, unknown>
): Promise<CobaltResponse> {
  const baseUrl = getCobaltUrl();

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  const apiKey = process.env.COBALT_API_KEY?.trim();

  if (apiKey) {
    headers.Authorization = `Api-Key ${apiKey}`;
  }

  const response = await fetch(baseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await response.text();

  let data: CobaltResponse;

  try {
    data = JSON.parse(text) as CobaltResponse;
  } catch {
    throw new Error(
      `Cobalt returned an invalid response (${response.status}).`
    );
  }

  if (!response.ok) {
    if (data.status === "error") {
      throw new Error(
        data.error?.code ??
          `Cobalt request failed with HTTP ${response.status}.`
      );
    }

    throw new Error(
      `Cobalt request failed with HTTP ${response.status}.`
    );
  }

  if (data.status === "error") {
    throw new Error(
      data.error?.code ?? "Cobalt could not process this source."
    );
  }

  return data;
}

async function getYoutubeOEmbed(
  url: string
): Promise<OEmbedResponse> {
  const endpoint =
    `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}` +
    `&format=json`;

  const response = await fetch(endpoint, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      "YouTube did not expose public metadata for this URL."
    );
  }

  return (await response.json()) as OEmbedResponse;
}

export async function inspectCobaltMedia(
  url: string
): Promise<MediaMetadata> {
  const metadata = await getYoutubeOEmbed(url);

  const formats: MediaFormat[] = VIDEO_QUALITIES.map(
    (quality) => ({
      id: quality,
      label:
        quality === "max"
          ? "Best"
          : `${quality}p`,
      ext: "MP4",
      protocol: "https",
      height:
        quality === "max"
          ? undefined
          : Number(quality),
      width:
        quality === "max"
          ? undefined
          : Math.round(
              Number(quality) * (16 / 9)
            ),
      hasAudio: true,
      audioOnly: false,
      requiresFfmpeg: false,
      note:
        quality === "max"
          ? "Highest available"
          : undefined,
    })
  );

  return {
    id: extractYoutubeId(url),
    sourceUrl: url,
    title: metadata.title ?? "YouTube video",
    author: metadata.author_name,
    duration: undefined,
    thumbnail: metadata.thumbnail_url,
    thumbnailWidth: metadata.thumbnail_width,
    thumbnailHeight: metadata.thumbnail_height,
    formats,
  };
}

export async function resolveCobaltDownload(
  url: string,
  options: {
    type: "video" | "audio";
    quality?: string;
    bitrate?: string;
  }
) {
  const body: Record<string, unknown> = {
    url,
    filenameStyle: "basic",
  };

  if (options.type === "audio") {
    body.audioFormat = "mp3";
    body.audioBitrate =
      options.bitrate ?? "320";
    body.downloadMode = "audio";
  } else {
    body.videoQuality =
      options.quality ?? "max";
    body.youtubeVideoCodec = "h264";
    body.youtubeVideoContainer = "mp4";
  }

  const result = await cobaltRequest(body);

  if (
    result.status === "redirect" ||
    result.status === "tunnel"
  ) {
    return {
      url: result.url,
      filename: result.filename,
      contentType:
        options.type === "audio"
          ? "audio/mpeg"
          : "video/mp4",
    };
  }

  if (result.status === "local-processing") {
    const tunnel = result.tunnel?.[0];

    if (!tunnel) {
      throw new Error(
        "Cobalt completed processing but did not return a download URL."
      );
    }

    return {
      url: tunnel,
      filename:
        result.output?.filename ??
        (options.type === "audio"
          ? "audio.mp3"
          : "video.mp4"),
      contentType:
        result.output?.type ??
        (options.type === "audio"
          ? "audio/mpeg"
          : "video/mp4"),
    };
  }

  if (result.status === "picker") {
    const firstVideo = result.picker?.find(
      (item) => item.type === "video"
    );

    if (!firstVideo?.url) {
      throw new Error(
        "Cobalt returned multiple media choices instead of a direct video."
      );
    }

    return {
      url: firstVideo.url,
      filename: "video.mp4",
      contentType: "video/mp4",
    };
  }

  throw new Error(
    "Cobalt did not return a downloadable media URL."
  );
}

function extractYoutubeId(url: string) {
  try {
    const parsed = new URL(url);

    if (parsed.hostname === "youtu.be") {
      return parsed.pathname.slice(1);
    }

    if (
      parsed.hostname === "youtube.com" ||
      parsed.hostname === "www.youtube.com"
    ) {
      const watchId = parsed.searchParams.get("v");

      if (watchId) {
        return watchId;
      }

      const parts = parsed.pathname
        .split("/")
        .filter(Boolean);

      if (
        parts[0] === "shorts" ||
        parts[0] === "embed"
      ) {
        return parts[1] ?? url;
      }
    }
  } catch {
    // Fall through.
  }

  return url;
}