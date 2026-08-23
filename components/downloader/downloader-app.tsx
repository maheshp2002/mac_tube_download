"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";

type IconName =
  | "activity" | "arrow-down" | "arrow-right" | "audio" | "check" | "chevron-down" | "chevron-right"
  | "clock" | "download" | "external" | "file" | "film" | "folder" | "history" | "image" | "info"
  | "link" | "moon" | "more" | "pause" | "play" | "refresh" | "search" | "settings" | "shield"
  | "spark" | "sun" | "trash" | "x";

function Icon({ name, size = 18, stroke = 1.8 }: { name: IconName; size?: number; stroke?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: stroke, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  const paths: Record<IconName, ReactNode> = {
    activity: <><path d="M3 12h4l3-8 4 16 3-8h4" /></>,
    "arrow-down": <><path d="M12 4v15" /><path d="m6 13 6 6 6-6" /></>,
    "arrow-right": <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    audio: <><path d="M11 5 6 9H3v6h3l5 4V5Z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9.2 9.2 0 0 1 0 13" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    "chevron-down": <path d="m6 9 6 6 6-6" />,
    "chevron-right": <path d="m9 6 6 6-6 6" />,
    clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></>,
    download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M4 20h16" /></>,
    external: <><path d="M14 5h5v5" /><path d="m19 5-8 8" /><path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></>,
    file: <><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8Z" /><path d="M14 3v5h5" /><path d="M8 13h8M8 17h5" /></>,
    film: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 5v14M17 5v14M3 9h4M17 9h4M3 15h4M17 15h4" /></>,
    folder: <><path d="M3.5 7.5h6l2 2h9v8.8a1.7 1.7 0 0 1-1.7 1.7H5.2a1.7 1.7 0 0 1-1.7-1.7Z" /><path d="M3.5 7.5V6.7A1.7 1.7 0 0 1 5.2 5h4l2 2h6.1" /></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 5v5h5" /><path d="M12 7v5l3 2" /></>,
    image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m5 17 4.5-4 3.2 3 2.2-2 4.1 4" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
    link: <><path d="M10 13.5a4 4 0 0 0 5.7.2l2-2a4 4 0 0 0-5.7-5.7l-1.1 1.1" /><path d="M14 10.5a4 4 0 0 0-5.7-.2l-2 2A4 4 0 0 0 12 18l1.1-1.1" /></>,
    moon: <path d="M20.5 14.8A8.5 8.5 0 0 1 9.2 3.5 8.5 8.5 0 1 0 20.5 14.8Z" />,
    more: <><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></>,
    pause: <><path d="M8 5v14M16 5v14" /></>,
    play: <path d="m9 6 9 6-9 6V6Z" fill="currentColor" stroke="none" />,
    refresh: <><path d="M20 11a8 8 0 0 0-14.5-3L3 11" /><path d="M3 5v6h6" /><path d="M4 13a8 8 0 0 0 14.5 3L21 13" /><path d="M21 19v-6h-6" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.5 1.5-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-2.1v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-1.5-1.5.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H7v-2.1h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.5-1.5.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V6h2.1v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.5 1.5-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2V14h-.2a1.7 1.7 0 0 0-1.6 1Z" /></>,
    shield: <><path d="M12 3 19 6v5c0 4.8-2.9 8-7 10-4.1-2-7-5.2-7-10V6Z" /><path d="m9 12 2 2 4-4" /></>,
    spark: <><path d="m12 3 1.4 5.6L19 10l-5.6 1.4L12 17l-1.4-5.6L5 10l5.6-1.4Z" /><path d="m19 16 .6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6Z" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    trash: <><path d="M4 7h16M10 11v5M14 11v5" /><path d="m6 7 .7 13h10.6L18 7M9 7V4h6v3" /></>,
    x: <><path d="m6 6 12 12M18 6 6 18" /></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

type Format = { id: string; label: string; ext: string; width?: number; height?: number; hasAudio: boolean; audioOnly?: boolean; size?: number; note?: string };
type Media = { id: string; sourceUrl: string; title: string; author?: string; duration?: number; thumbnail?: string; thumbnailWidth?: number; thumbnailHeight?: number; formats: Format[] };
type HistoryItem = { id: string; title: string; format: string; detail: string; size: string; thumbnail?: string; createdAt: string };
type JobState = "idle" | "inspecting" | "downloading" | "processing" | "complete" | "error";

const DEMO_MEDIA: Media = {
  id: "jNQXAC9IVRw", sourceUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw", title: "Me at the zoo", author: "Jawed Karim", duration: 19,
  thumbnail: "https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg", thumbnailWidth: 480, thumbnailHeight: 360,
  formats: [
    { id: "134", label: "240p", ext: "MP4", width: 426, height: 240, hasAudio: false, size: 575740 },
    { id: "160", label: "144p", ext: "MP4", width: 256, height: 144, hasAudio: false, size: 208000 },
  ],
};
const audioOptions = [{ id: "320", label: "320 kbps", caption: "Best quality", size: "8.4 MB" }, { id: "256", label: "256 kbps", caption: "High quality", size: "6.9 MB" }, { id: "192", label: "192 kbps", caption: "Balanced", size: "5.2 MB" }];

function formatDuration(seconds?: number) {
  if (!seconds) return "—";
  const hours = Math.floor(seconds / 3600); const minutes = Math.floor((seconds % 3600) / 60); const secs = Math.floor(seconds % 60);
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}` : `${minutes}:${String(secs).padStart(2, "0")}`;
}
function formatBytes(bytes?: number) {
  if (!bytes) return "Size varies";
  if (bytes > 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  return `${(bytes / 1024 ** 2).toFixed(bytes > 10 * 1024 ** 2 ? 0 : 1)} MB`;
}
function hostFromUrl(url: string) { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "media source"; } }
function isUrl(value: string) { try { const parsed = new URL(value); return ["http:", "https:"].includes(parsed.protocol) && Boolean(parsed.hostname); } catch { return false; } }
function bestFormat(media?: Media) { return media?.formats.find((format) => !format.audioOnly) ?? media?.formats[0]; }

function NavItem({ icon, label, active, badge, onClick }: { icon: IconName; label: string; active?: boolean; badge?: string; onClick?: () => void }) {
  return <button className={`nav-item ${active ? "nav-item-active" : ""}`} onClick={onClick} type="button"><Icon name={icon} size={17} /><span>{label}</span>{badge ? <span className="nav-badge">{badge}</span> : null}</button>;
}
function Logo() { return <div className="brand-mark" aria-label="LocalDrop"><span className="brand-mark-dot" /><span className="brand-mark-line" /><span className="brand-mark-dot" /></div>; }

export default function DownloaderApp() {
  const [url, setUrl] = useState(""); const [media, setMedia] = useState<Media>(); const [jobState, setJobState] = useState<JobState>("idle"); const [progress, setProgress] = useState(0); const [jobMessage, setJobMessage] = useState("");
  const [error, setError] = useState<{ message: string; details?: string }>(); const [activeSection, setActiveSection] = useState<"workspace" | "history">("workspace"); const [selectedVideo, setSelectedVideo] = useState<string>(); const [selectedAudio, setSelectedAudio] = useState("320");
  const [history, setHistory] = useState<HistoryItem[]>(() => { if (typeof window === "undefined") return []; try { return JSON.parse(window.localStorage.getItem("localdrop-history") ?? "[]") as HistoryItem[]; } catch { return []; } }); const [toast, setToast] = useState<string>(); const [isDark, setIsDark] = useState(() => typeof window === "undefined" || window.localStorage.getItem("localdrop-theme") !== "light"); const [showDetails, setShowDetails] = useState(false); const abortRef = useRef<AbortController | undefined>(undefined);

  useEffect(() => { document.documentElement.dataset.theme = isDark ? "dark" : "light"; window.localStorage.setItem("localdrop-theme", isDark ? "dark" : "light"); }, [isDark]);
  useEffect(() => { if (!toast) return; const timeout = window.setTimeout(() => setToast(undefined), 3800); return () => window.clearTimeout(timeout); }, [toast]);

  const topFormat = useMemo(() => bestFormat(media), [media]); const videoFormats = useMemo(() => media?.formats.filter((format) => !format.audioOnly).slice(0, 8) ?? [], [media]); const chosenFormat = videoFormats.find((format) => format.id === selectedVideo) ?? topFormat;
  function saveHistory(item: HistoryItem) { const next = [item, ...history.filter((entry) => entry.id !== item.id)].slice(0, 8); setHistory(next); window.localStorage.setItem("localdrop-history", JSON.stringify(next)); }

  async function inspectUrl(event?: FormEvent) {
    event?.preventDefault(); setError(undefined); setShowDetails(false);
    if (!isUrl(url.trim())) { setError({ message: "Enter a valid HTTP or HTTPS media URL.", details: "The URL must include a hostname, for example https://www.example.com/video." }); return; }
    setJobState("inspecting"); setMedia(undefined); setProgress(0); setJobMessage("Reading available formats…");
    try { const response = await fetch("/api/metadata", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: url.trim() }) }); const result = await response.json(); if (!response.ok) throw new Error(result.message ?? "The source did not return usable media metadata."); setMedia(result.media); setSelectedVideo(result.media.formats[0]?.id); setJobState("idle"); setJobMessage(""); }
    catch (cause) { setJobState("error"); setError({ message: cause instanceof Error ? cause.message : "The source could not be inspected.", details: "Try another URL or confirm the source is publicly reachable from this computer." }); }
  }
  function useDemo() { setUrl(DEMO_MEDIA.sourceUrl); setMedia(DEMO_MEDIA); setSelectedVideo(DEMO_MEDIA.formats[0].id); setError(undefined); setJobState("idle"); setJobMessage(""); setActiveSection("workspace"); }

  async function startDownload(kind: "video" | "audio" | "thumbnail", formatOverride?: Format) {
    if (!media) return; const formatForDownload = formatOverride ?? chosenFormat; setError(undefined); setJobState(kind === "audio" ? "processing" : "downloading"); setProgress(4); setJobMessage(kind === "thumbnail" ? "Fetching thumbnail…" : kind === "audio" ? "Converting audio…" : "Fetching media…");
    const controller = new AbortController(); abortRef.current = controller;
    try {
      const endpoint = kind === "thumbnail" ? "/api/thumbnail" : "/api/download"; const body = kind === "thumbnail" ? { url: media.sourceUrl } : { url: media.sourceUrl, title: media.title, formatId: formatForDownload?.id, hasAudio: formatForDownload?.hasAudio, type: kind, bitrate: selectedAudio };
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: controller.signal });
      if (!response.ok) { const result = await response.json().catch(() => ({ message: "The local server could not prepare this download." })); throw new Error(result.message ?? "The local server could not prepare this download."); }
      const total = Number(response.headers.get("content-length") ?? 0); const reader = response.body?.getReader(); if (!reader) throw new Error("The source returned an empty file."); const chunks: Uint8Array[] = []; let received = 0;
      while (true) { const { done, value } = await reader.read(); if (done) break; if (value) { chunks.push(value); received += value.length; if (total) setProgress(Math.min(96, Math.round((received / total) * 100))); } }
      const output = new ArrayBuffer(received); const merged = new Uint8Array(output); let offset = 0; chunks.forEach((chunk) => { merged.set(chunk, offset); offset += chunk.byteLength; }); const blob = new Blob([output], { type: response.headers.get("content-type") ?? "application/octet-stream" }); const objectUrl = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = objectUrl; anchor.download = response.headers.get("content-disposition")?.match(/filename="?([^";]+)"?/i)?.[1] ?? `${media.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.${kind === "audio" ? "mp3" : kind === "thumbnail" ? "jpg" : formatForDownload?.ext.toLowerCase() ?? "mp4"}`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(objectUrl);
      setProgress(100); setJobState("complete"); setJobMessage(kind === "audio" ? "MP3 is ready" : kind === "thumbnail" ? "Thumbnail is ready" : "Your file is ready"); const detail = kind === "audio" ? `MP3 • ${selectedAudio} kbps` : kind === "thumbnail" ? "JPG • Original" : `${formatForDownload?.label ?? "Best quality"} • ${formatForDownload?.ext ?? "MP4"}`; saveHistory({ id: `${media.id}-${kind}-${Date.now()}`, title: media.title, format: kind === "audio" ? "MP3" : kind === "thumbnail" ? "JPG" : formatForDownload?.ext ?? "MP4", detail, size: kind === "audio" ? `${audioOptions.find((item) => item.id === selectedAudio)?.size ?? "—"}` : formatBytes(formatForDownload?.size), thumbnail: media.thumbnail, createdAt: new Date().toISOString() }); setToast("Download saved to your browser’s downloads");
    } catch (cause) { if (cause instanceof DOMException && cause.name === "AbortError") { setJobState("idle"); setJobMessage("Download cancelled"); setToast("Download cancelled"); } else { setJobState("error"); setError({ message: cause instanceof Error ? cause.message : "The download could not be completed.", details: "No file was saved. Temporary files are cleaned up automatically by the local server." }); } }
    finally { abortRef.current = undefined; }
  }
  function cancelDownload() { abortRef.current?.abort(); }
  function resetWorkspace() { cancelDownload(); setUrl(""); setMedia(undefined); setError(undefined); setJobState("idle"); setJobMessage(""); setProgress(0); }
  function clearHistory() { setHistory([]); window.localStorage.removeItem("localdrop-history"); setToast("Download history cleared"); }

  return <div className="app-shell">
    <aside className="sidebar"><div className="sidebar-top"><div className="brand"><Logo /><span>localdrop</span></div><span className="local-pill"><span />LOCAL</span></div><div className="sidebar-nav"><p className="sidebar-label">WORKSPACE</p><NavItem icon="spark" label="Downloader" active={activeSection === "workspace"} onClick={() => setActiveSection("workspace")} /><NavItem icon="history" label="History" badge={history.length ? String(history.length).padStart(2, "0") : undefined} active={activeSection === "history"} onClick={() => setActiveSection("history")} /><p className="sidebar-label sidebar-label-spaced">TOOLS</p><NavItem icon="folder" label="Downloads folder" onClick={() => setToast("Files are saved through your browser's Downloads folder")} /><NavItem icon="settings" label="Preferences" onClick={() => setToast("Preferences are coming to this local workspace")} /></div><div className="sidebar-bottom"><div className="privacy-card"><div className="privacy-icon"><Icon name="shield" size={15} /></div><div><strong>Private by design</strong><span>Files never leave your device.</span></div></div><button className="profile-row" type="button" onClick={() => setToast("You are using Local mode")}><span className="avatar">L</span><span className="profile-copy"><strong>Local mode</strong><small>Offline workspace</small></span><Icon name="more" size={17} /></button></div></aside>
    <main className="main-content"><header className="topbar"><div className="mobile-brand"><Logo /><span>localdrop</span></div><div className="breadcrumb"><span>Workspace</span><Icon name="chevron-right" size={13} /><strong>{activeSection === "workspace" ? "Downloader" : "History"}</strong></div><div className="top-actions"><span className="status-dot"><span />All systems local</span><button className="icon-button" type="button" aria-label="Toggle color mode" onClick={() => setIsDark((current) => !current)}><Icon name={isDark ? "sun" : "moon"} size={17} /></button><button className="help-button" type="button" onClick={() => setToast("Paste a URL from a source you are authorized to download")}>?</button></div></header>
      {activeSection === "history" ? <section className="history-page page-width"><div className="page-heading"><div><span className="eyebrow">YOUR LIBRARY</span><h1>Recent downloads</h1><p>Everything you have saved stays on this device.</p></div>{history.length ? <button className="ghost-button danger-button" type="button" onClick={clearHistory}><Icon name="trash" size={15} />Clear history</button> : null}</div>{history.length ? <div className="history-list">{history.map((item) => <div className="history-row" key={item.id}><div className="history-thumb">{item.thumbnail ? <img src={item.thumbnail} alt="" /> : <Icon name="file" size={20} />}<span className="history-type">{item.format}</span></div><div className="history-main"><strong>{item.title}</strong><span>{item.detail} <i>•</i> {item.size}</span></div><time>{new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}<br />{new Date(item.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</time><button className="icon-button subtle" type="button" aria-label="More options"><Icon name="more" size={17} /></button></div>)}</div> : <div className="empty-history"><div className="empty-history-icon"><Icon name="download" size={25} /></div><h2>No downloads yet</h2><p>Files you save from the workspace will appear here.</p><button className="primary-button" type="button" onClick={() => setActiveSection("workspace")}><Icon name="arrow-right" size={17} />Go to downloader</button></div>}</section> : <section className={`workspace page-width ${media ? "has-media" : ""}`}>
        <div className="workspace-intro"><div><span className="eyebrow">LOCAL MEDIA WORKSPACE</span><h1>Download <em>&</em> convert.</h1><p>Bring your media home. Fast, private, and entirely on your machine.</p></div><div className="intro-stat"><span className="stat-icon"><Icon name="activity" size={18} /></span><span><strong>0</strong><small>active jobs</small></span></div></div>
        <form className={`url-bar ${jobState === "inspecting" ? "is-loading" : ""}`} onSubmit={inspectUrl}><div className="url-leading"><Icon name="link" size={20} /></div><input aria-label="Media URL" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Paste a media URL to get started…" type="url" /><span className="url-host">{url && isUrl(url) ? hostFromUrl(url) : ""}</span><button className="url-submit" type="submit" disabled={jobState === "inspecting"}>{jobState === "inspecting" ? <span className="spinner" /> : <Icon name="arrow-right" size={20} />}</button></form>
        <div className="url-hint"><span><Icon name="shield" size={13} />Private & local</span><i />Supports video, audio and thumbnails<button type="button" onClick={useDemo}>Try a sample</button></div>
        {error ? <div className="error-card"><div className="error-icon"><Icon name="info" size={18} /></div><div className="error-copy"><strong>{error.message}</strong><span>We couldn’t prepare this source.</span>{showDetails ? <details open><summary>Technical details</summary><code>{error.details}</code></details> : null}</div><button className="details-button" type="button" onClick={() => setShowDetails((current) => !current)}>{showDetails ? "Hide details" : "Details"}</button><button className="close-error" type="button" aria-label="Dismiss error" onClick={() => setError(undefined)}><Icon name="x" size={16} /></button></div> : null}
        {jobState === "inspecting" ? <div className="loading-panel"><div className="skeleton thumb-skeleton" /><div className="loading-copy"><span className="skeleton line-wide" /><span className="skeleton line-short" /><span className="skeleton line-medium" /></div><div className="loading-label"><span className="spinner" />{jobMessage}</div></div> : null}
        {!media && jobState !== "inspecting" && !error ? <div className="empty-state"><div className="empty-illustration"><div className="empty-orb orb-one" /><div className="empty-orb orb-two" /><div className="empty-card"><Icon name="download" size={28} /><span>MP4</span></div><div className="empty-card card-back"><Icon name="audio" size={25} /><span>MP3</span></div></div><h2>Paste a URL to begin</h2><p>Drop in a link from a supported source and we’ll find the best available formats.</p><div className="supported-row"><span><Icon name="film" size={14} />Video</span><span><Icon name="audio" size={14} />Audio</span><span><Icon name="image" size={14} />Thumbnails</span></div></div> : null}
        {media ? <div className="media-workspace"><div className="media-header"><div className="media-heading"><div className="source-badge"><span className="source-dot" />{hostFromUrl(media.sourceUrl)}</div><h2>{media.title}</h2><div className="media-meta"><span>{media.author ?? "Unknown creator"}</span><i />{formatDuration(media.duration)}<i />{media.formats.length} formats found</div></div><button className="ghost-button" type="button" onClick={resetWorkspace}><Icon name="refresh" size={15} />New URL</button></div><div className="preview-grid"><div className="preview-card"><div className="preview-image">{media.thumbnail ? <img src={media.thumbnail} alt="" /> : <div className="preview-placeholder"><Icon name="film" size={28} /></div>}<button className="preview-play" type="button" aria-label="Preview media" onClick={() => setToast("Preview is available after downloading the file")}><Icon name="play" size={15} /></button><span className="duration-pill">{formatDuration(media.duration)}</span></div><div className="preview-bottom"><div><span className="preview-label">SOURCE</span><a href={media.sourceUrl} target="_blank" rel="noreferrer">{hostFromUrl(media.sourceUrl)} <Icon name="external" size={12} /></a></div><button className="text-button" type="button" onClick={() => startDownload("thumbnail")}><Icon name="image" size={15} />Save thumbnail</button></div></div><div className="format-panel"><div className="panel-heading"><div><span className="eyebrow">VIDEO</span><h3>Choose quality</h3></div><span className="format-count">{videoFormats.length} available</span></div><div className="best-quality"><div className="best-icon"><Icon name="spark" size={17} /></div><div className="best-copy"><strong>Best quality</strong><span>{videoFormats.length && topFormat ? `${topFormat.label} • ${topFormat.ext} • ${topFormat.hasAudio ? "Video + audio" : "Video + separate audio"}` : "No video stream was exposed"}</span></div><span className="recommended">RECOMMENDED</span><button type="button" disabled={!videoFormats.length} onClick={() => { setSelectedVideo(topFormat?.id); startDownload("video", topFormat); }}><Icon name="download" size={15} />Download</button></div><div className="quality-list">{videoFormats.length ? videoFormats.map((format) => <button className={`quality-row ${chosenFormat?.id === format.id ? "selected" : ""}`} key={format.id} type="button" onClick={() => setSelectedVideo(format.id)}><span className="radio-check">{chosenFormat?.id === format.id ? <Icon name="check" size={13} /> : null}</span><span className="quality-name"><strong>{format.label}</strong><small>{format.width && format.height ? `${format.width} × ${format.height}` : "Original dimensions"}</small></span><span className="quality-format">{format.ext}</span><span className="quality-audio">{format.hasAudio ? "Video + audio" : "Video only"}</span><span className="quality-size">{formatBytes(format.size)}</span><Icon name="chevron-right" size={16} /></button>) : <div className="no-formats"><Icon name="info" size={15} />No video formats were returned for this source.</div>}</div><button className="download-selected" type="button" disabled={!chosenFormat || !videoFormats.length || jobState === "downloading" || jobState === "processing"} onClick={() => startDownload("video")}><Icon name="download" size={16} />Download {chosenFormat?.label ?? "selected quality"}<span>{formatBytes(chosenFormat?.size)}</span></button></div></div><div className="audio-card"><div className="audio-card-heading"><div className="audio-icon"><Icon name="audio" size={19} /></div><div><span className="eyebrow">AUDIO CONVERTER</span><h3>Take the sound with you</h3><p>Convert the best available audio source to a clean MP3.</p></div><span className="converted-label">CONVERTED</span></div><div className="audio-options">{audioOptions.map((option) => <button type="button" key={option.id} className={`audio-option ${selectedAudio === option.id ? "selected" : ""}`} onClick={() => setSelectedAudio(option.id)}><span className="radio-check">{selectedAudio === option.id ? <Icon name="check" size={13} /> : null}</span><span><strong>{option.label}</strong><small>{option.caption}</small></span><em>{option.size}</em></button>)}<button className="audio-download" type="button" disabled={jobState === "downloading" || jobState === "processing"} onClick={() => startDownload("audio")}><Icon name="download" size={16} />Download MP3</button></div><div className="audio-note"><Icon name="info" size={14} />Original source is preserved; MP3 conversion may be lossy.</div></div></div> : null}
        {jobState === "downloading" || jobState === "processing" || jobState === "complete" ? <div className={`progress-card ${jobState === "complete" ? "complete" : ""}`}><div className="progress-icon">{jobState === "complete" ? <Icon name="check" size={18} /> : jobState === "processing" ? <Icon name="spark" size={18} /> : <Icon name="download" size={18} />}</div><div className="progress-copy"><strong>{jobState === "complete" ? "Download complete" : jobState === "processing" ? "Processing your file" : "Downloading your file"}</strong><span>{jobMessage}</span></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><strong className="progress-percent">{progress}%</strong>{jobState !== "complete" ? <button type="button" className="cancel-button" onClick={cancelDownload}>Cancel</button> : <button type="button" className="cancel-button done-button" onClick={resetWorkspace}>Download another</button>}</div> : null}
        <footer className="workspace-footer"><span><Icon name="shield" size={14} />Your files stay on this device</span><span><Icon name="activity" size={14} />Powered by local processing</span><span className="footer-version">v1.0.0 <Icon name="more" size={15} /></span></footer>
      </section>}
    </main>
    {toast ? <div className="toast"><span className="toast-check"><Icon name="check" size={13} /></span>{toast}<button type="button" onClick={() => setToast(undefined)}><Icon name="x" size={13} /></button></div> : null}
  </div>;
}
