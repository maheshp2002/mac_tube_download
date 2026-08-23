"use client";

import Link from "next/link";
import { useState } from "react";

type HistoryItem = { id: string; title: string; format: string; detail: string; size: string; thumbnail?: string; createdAt: string };

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>(() => { if (typeof window === "undefined") return []; try { return JSON.parse(window.localStorage.getItem("localdrop-history") ?? "[]") as HistoryItem[]; } catch { return []; } });

  function clearHistory() {
    window.localStorage.removeItem("localdrop-history");
    setItems([]);
  }

  return <main className="standalone-history"><header className="standalone-header"><Link href="/" className="brand"><span className="brand-mark"><span className="brand-mark-dot" /><span className="brand-mark-line" /><span className="brand-mark-dot" /></span><span>localdrop</span></Link><Link href="/" className="ghost-button">Back to downloader</Link></header><section className="history-page page-width"><div className="page-heading"><div><span className="eyebrow">YOUR LIBRARY</span><h1>Recent downloads</h1><p>Everything you have saved stays on this device.</p></div>{items.length ? <button className="ghost-button danger-button" type="button" onClick={clearHistory}>Clear history</button> : null}</div>{items.length ? <div className="history-list">{items.map((item) => <div className="history-row" key={item.id}><div className="history-thumb">{item.thumbnail ? <img src={item.thumbnail} alt="" /> : <span>FILE</span>}<span className="history-type">{item.format}</span></div><div className="history-main"><strong>{item.title}</strong><span>{item.detail} <i>•</i> {item.size}</span></div><time>{new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}<br />{new Date(item.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</time></div>)}</div> : <div className="empty-history"><div className="empty-history-icon">↓</div><h2>No downloads yet</h2><p>Files you save from the workspace will appear here.</p><Link className="primary-button" href="/">Go to downloader</Link></div>}</section></main>;
}
