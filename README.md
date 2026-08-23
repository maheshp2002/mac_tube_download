# LocalDrop

LocalDrop is a local-only media downloader and converter built with Next.js App Router. It inspects authorized media URLs with `yt-dlp`, which provides extractors for many video sites plus a generic extractor for direct MP4, HLS, and DASH media URLs. It uses the `ffmpeg-static` binary for muxing and MP3 conversion, and returns files through the browser’s normal download flow. No downloaded files or history are uploaded; history metadata stays in browser localStorage.

## Run locally

```bash
pnpm install
pnpm dev
```

Set `MEDIA_MODE=local` in `.env.local` for local development. Local mode uses the standalone yt-dlp binary. Set `MEDIA_MODE=server` in the Vercel project environment to use the Node-only server extractor instead; Vercel defaults to server mode when the variable is omitted.

Open [http://localhost:3000](http://localhost:3000). The binary dependencies are installed through pnpm; the app downloads the standalone yt-dlp executable and does not require Python or a global FFmpeg/yt-dlp install.

Local mode can handle supported sites such as YouTube, Instagram, Facebook, and many more through yt-dlp. Server mode does not install or run yt-dlp/Python: it extracts public direct files exposed by HTML5 video/audio tags, OpenGraph metadata, JSON-LD, and embedded page data no-JavaScript MP4 player. Server-mode downloads are handed directly to the browser; HLS-only sources, protected pages, and MP3 conversion require local mode.

On Vercel, server-mode downloads use ranged requests through a small referer-aware proxy and are reassembled in the browser, keeping each Function response below Vercel’s 4.5 MB limit. DRM-protected streams, private/login-only pages, expiring URLs, HLS-only sources, and sites that actively block server-side access may still require credentials or may not be downloadable.

## Routes

- `/` — downloader workspace
- `/history` — local download history
- `POST /api/metadata` — inspect a media URL
- `POST /api/download` — download video or convert audio to MP3
- `POST /api/thumbnail` — download the best available thumbnail
- `POST /api/convert` — compatibility alias for the audio/video download handler

Use the downloader only with sources and media you are authorized to access. The app is intended for local educational use and does not include cloud storage, external databases, queues, or hosted infrastructure.
