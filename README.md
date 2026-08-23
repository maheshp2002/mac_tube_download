# LocalDrop

LocalDrop is a local-only media downloader and converter built with Next.js App Router. It inspects authorized media URLs with `yt-dlp`, uses the `ffmpeg-static` binary for muxing and MP3 conversion, and returns files through the browser’s normal download flow. No downloaded files or history are uploaded; history metadata stays in browser localStorage.

## Run locally

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The binary dependencies are installed through pnpm; the app downloads the standalone yt-dlp executable and does not require Python or a global FFmpeg/yt-dlp install.

## Routes

- `/` — downloader workspace
- `/history` — local download history
- `POST /api/metadata` — inspect a media URL
- `POST /api/download` — download video or convert audio to MP3
- `POST /api/thumbnail` — download the best available thumbnail
- `POST /api/convert` — compatibility alias for the audio/video download handler

Use the downloader only with sources and media you are authorized to access. The app is intended for local educational use and does not include cloud storage, external databases, queues, or hosted infrastructure.
