// LocalDrop Content Script
(function () {
  // 1. Announce presence to LocalDrop webapp
  const announcePresence = () => {
    try {
      document.documentElement.dataset.localdropExtension = "1.0.0";
      window.postMessage({ type: "LOCALDROP_EXTENSION_INSTALLED", version: "1.0.0" }, "*");
    } catch {
      // Ignored
    }
  };

  announcePresence();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", announcePresence);
  }

  // 2. Respond to pings from LocalDrop webapp and sync server URL
  window.addEventListener("message", (event) => {
    if (event.data && event.data.type === "PING_LOCALDROP_EXTENSION") {
      announcePresence();
    }
    if (event.data && event.data.type === "LOCALDROP_SYNC_SERVER_URL" && event.data.serverUrl) {
      try {
        const u = new URL(event.data.serverUrl);
        if (u.protocol === "http:" || u.protocol === "https:") {
          chrome.runtime.sendMessage({
            type: "SYNC_SERVER_URL",
            serverUrl: u.origin,
          });
        }
      } catch {
        // Ignored
      }
    }
  });

  // 3. Listen for in-page toast messages from extension popup/background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "SHOW_TOAST") {
      showInPageToast(message.title, message.text, message.variant);
    }
  });

  function showInPageToast(title, text, variant = "info") {
    let container = document.getElementById("localdrop-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "localdrop-toast-container";
      container.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 2147483647;
        display: flex;
        flex-direction: column;
        gap: 10px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        pointer-events: none;
      `;
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    const bg = variant === "error" ? "#dc2626" : variant === "success" ? "#16a34a" : "#4f46e5";
    toast.style.cssText = `
      background: #111827;
      color: #f9fafb;
      border: 1px solid #374151;
      border-left: 4px solid ${bg};
      padding: 12px 16px;
      border-radius: 10px;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5);
      font-size: 13px;
      line-height: 1.4;
      max-width: 340px;
      pointer-events: auto;
      transition: all 0.25s ease;
      opacity: 0;
      transform: translateY(10px);
    `;

    toast.innerHTML = `
      <div style="font-weight: 600; color: #fff; margin-bottom: 2px;">${escapeHtml(title)}</div>
      <div style="color: #9ca3af; font-size: 12px;">${escapeHtml(text)}</div>
    `;

    container.appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateY(0)";
    });

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // 4. Report browser theme preference to background service worker for dynamic icon adaptation
  try {
    const themeMedia = window.matchMedia("(prefers-color-scheme: dark)");
    const reportTheme = (isDark) => {
      chrome.runtime.sendMessage({
        type: "THEME_CHANGED",
        isDark: typeof isDark === "boolean" ? isDark : themeMedia.matches,
      }).catch(() => {});
    };

    reportTheme(themeMedia.matches);
    themeMedia.addEventListener("change", (e) => reportTheme(e.matches));
  } catch {
    // Ignored
  }
})();

