# LocalDrop

LocalDrop is a local-only media downloader and converter built with Next.js App Router. It inspects authorized media URLs with `yt-dlp`, which provides extractors for many video sites plus a generic extractor for direct MP4, HLS, and DASH media URLs. It uses the `ffmpeg-static` binary for muxing and MP3 conversion, and returns files through the browser’s normal download flow. No downloaded files or history are uploaded; history metadata stays in browser localStorage.

## Run locally

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The binary dependencies are installed through pnpm; the app downloads the standalone yt-dlp executable and does not require Python or a global FFmpeg/yt-dlp install.

The extractor can handle supported sites such as YouTube, Instagram, Facebook, and many more. It can also process public direct media URLs and manifests. Progressive single-file formats are resolved to their original stream and downloaded directly by the browser without starting FFmpeg. Video-only formats, HLS/DASH manifests, and MP3 conversion use FFmpeg when muxing or conversion is required.

On Vercel, direct progressive downloads avoid the Function response proxy, so large files can be handed to the browser without passing through the serverless response. Processed files still depend on Vercel’s 4.5 MB Function response limit; choose a progressive format for large downloads or use a host with file storage. DRM-protected streams, private/login-only pages, expiring URLs, and sites that actively block server-side access may still require credentials or may not be downloadable.

## Routes

- `/` — downloader workspace
- `/history` — local download history
- `POST /api/metadata` — inspect a media URL
- `POST /api/download` — download video or convert audio to MP3
- `POST /api/thumbnail` — download the best available thumbnail
- `POST /api/convert` — compatibility alias for the audio/video download handler

Use the downloader only with sources and media you are authorized to access. The app is intended for local educational use and does not include cloud storage, external databases, queues, or hosted infrastructure.
