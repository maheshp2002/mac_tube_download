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

async function handleDownload(payload) {
  const { serverUrl, downloadPayload, filename } = payload;
  const targetUrl = (serverUrl || DEFAULT_SERVER_URL).replace(/\/$/, "");

  // 1. Send request to LocalDrop backend
  const response = await fetch(`${targetUrl}/api/download`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(downloadPayload),
  });

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

