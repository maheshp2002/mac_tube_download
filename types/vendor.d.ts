declare module "yt-dlp-exec" {
  type YtDlpResult = Record<string, unknown>;
  type YtDlp = ((url: string, flags?: Record<string, unknown>, options?: Record<string, unknown>) => Promise<YtDlpResult>) & {
    exec: (url: string, flags?: Record<string, unknown>, options?: Record<string, unknown>) => Promise<{ stdout: string; stderr: string }>;
  };
  const ytdlp: YtDlp;
  export default ytdlp;
}
