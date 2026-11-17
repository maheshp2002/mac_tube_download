// LocalDrop Background Service Worker

try {
  importScripts("config.js");
} catch (e) {
  // If config.js is not present, fall back to default
}

const DEFAULT_SERVER_URL =
  (typeof self.LOCALDROP_CONFIG !== "undefined" && self.LOCALDROP_CONFIG?.defaultServerUrl) ||
  "http://localhost:3000";

// Ensure default settings
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["serverUrl", "defaultFormat", "defaultVideoQuality", "defaultAudioBitrate"], (res) => {
    const updates = {};
    if (
      !res.serverUrl ||
      (res.serverUrl.includes("localhost:3000") && !DEFAULT_SERVER_URL.includes("localhost:3000"))
    ) {
      updates.serverUrl = DEFAULT_SERVER_URL;
    }
    if (!res.defaultFormat) updates.defaultFormat = "video";
    if (!res.defaultVideoQuality) updates.defaultVideoQuality = "best";
    if (!res.defaultAudioBitrate) updates.defaultAudioBitrate = "320";
    if (Object.keys(updates).length > 0) {
      chrome.storage.local.set(updates);
    }
  });
});

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "TRIGGER_DOWNLOAD") {
    handleDownload(request.payload)
      .then((res) => sendResponse({ success: true, ...res }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keep channel open for async response
  }

  // Update toolbar icon to match browser/OS theme (light or dark)
  if (request.type === "THEME_CHANGED" && typeof request.isDark === "boolean") {
    updateToolbarTheme(request.isDark);
    sendResponse({ success: true });
    return true;
  }

  // Auto-sync server URL from active web app
  if (request.type === "SYNC_SERVER_URL" && request.serverUrl) {
    chrome.storage.local.get(["serverUrl"], (res) => {
      if (!res.serverUrl || res.serverUrl.includes("localhost:3000")) {
        chrome.storage.local.set({ serverUrl: request.serverUrl });
      }
    });
    sendResponse({ success: true });
    return true;
  }
});

// Dynamic theme adaptation for toolbar icon
function updateToolbarTheme(isDark) {
  const variant = isDark ? "light" : "dark";
  try {
    chrome.action.setIcon({
      path: {
        "16": `icons/icon-16-${variant}.png`,
        "32": `icons/icon-32-${variant}.png`,
        "48": `icons/icon-48-${variant}.png`,
        "128": `icons/icon-128-${variant}.png`,
      },
    });
  } catch (err) {
    console.warn("[LocalDrop] Failed to update toolbar icon theme:", err);
  }
}

async function handleDownload(payload) {
  const { serverUrl, downloadPayload, filename } = payload;
  const targetUrl = (serverUrl || DEFAULT_SERVER_URL).replace(/\/$/, "");

  const isLocal = targetUrl.includes("localhost") || targetUrl.includes("127.0.0.1");
  const attempts = isLocal ? [4] : [50, 30, 30]; // 50s, 30s, 30s retry schedule for sleeping cloud servers (Render)
  let lastError = null;
  let response = null;

  for (let i = 0; i < attempts.length; i++) {
    const attemptNum = i + 1;
    const duration = attempts[i];
    let secondsLeft = duration;

    const controller = new AbortController();
    const intervalId = setInterval(() => {
      secondsLeft--;
      if (secondsLeft >= 0) {
        try {
          chrome.runtime.sendMessage({
            type: "DOWNLOAD_WAKING_UP",
            attempt: attemptNum,
            maxAttempts: attempts.length,
            secondsLeft,
            duration,
          });
        } catch {}
      }
    }, 1000);

    const timerId = setTimeout(() => controller.abort(), duration * 1000);

    try {
      response = await fetch(`${targetUrl}/api/download`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(downloadPayload),
        signal: controller.signal,
      });

      clearTimeout(timerId);
      clearInterval(intervalId);

      // Render returns 502/503/504 while waking up
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        throw new Error(`Server is booting (HTTP ${response.status})`);
      }

      break; // Successfully connected and received response!
    } catch (err) {
      clearTimeout(timerId);
      clearInterval(intervalId);
      lastError = err;
      console.warn(`[LocalDrop] Download connect attempt ${attemptNum}/${attempts.length} failed:`, err.message);

      if (i < attempts.length - 1) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  if (!response) {
    throw lastError || new Error(`Could not connect to server at ${targetUrl} after multiple wake-up attempts.`);
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.message || `Download failed with HTTP ${response.status}`);
  }

  // Extract filename from header if present
  let resolvedFilename = filename || "download.mp4";
  const disposition = response.headers.get("content-disposition");
  if (disposition && disposition.includes("filename=")) {
    const match = disposition.match(/filename=["']?([^"';]+)["']?/i);
    if (match && match[1]) {
      resolvedFilename = decodeURIComponent(match[1]);
    }
  }

  // 2. Read as blob and hand off to chrome.downloads
  const blob = await response.blob();
  const reader = new FileReader();

  return new Promise((resolve, reject) => {
    reader.onloadend = () => {
      const dataUrl = reader.result;
      chrome.downloads.download(
        {
          url: dataUrl,
          filename: resolvedFilename,
          saveAs: false,
        },
        (downloadId) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            // Show desktop notification
            try {
              chrome.notifications.create({
                type: "basic",
                iconUrl: "icons/icon-128.png",
                title: "LocalDrop Download Started",
                message: resolvedFilename,
                priority: 1,
              });
            } catch {
              // Notification permission optional
            }
            resolve({ downloadId, filename: resolvedFilename });
          }
        }
      );
    };
    reader.onerror = () => reject(new Error("Failed to read downloaded media blob"));
    reader.readAsDataURL(blob);
  });
}

