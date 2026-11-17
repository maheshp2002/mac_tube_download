// LocalDrop Popup Script

// 50s, 30s, 30s retry schedule for sleeping cloud servers (Render free tier cold start)
const WAKEUP_SCHEDULE = [50, 30, 30];

document.addEventListener("DOMContentLoaded", async () => {
  // Elements
  const serverStatusDot = document.getElementById("server-status-dot");
  const btnSettings = document.getElementById("btn-settings");
  const settingsPanel = document.getElementById("settings-panel");
  const inputServerUrl = document.getElementById("input-server-url");
  const btnSaveServer = document.getElementById("btn-save-server");

  const activeUrlDisplay = document.getElementById("active-url-display");
  const stateInspecting = document.getElementById("state-inspecting");
  const skeletonHint = document.getElementById("skeleton-hint");
  const stateMedia = document.getElementById("state-media");
  const stateEmpty = document.getElementById("state-empty");
  const stateWakingUp = document.getElementById("state-waking-up");
  const wakingUpTitle = document.getElementById("waking-up-title");
  const wakingUpSub = document.getElementById("waking-up-sub");
  const wakingUpSeconds = document.getElementById("waking-up-seconds");
  const wakingUpAttempt = document.getElementById("waking-up-attempt");
  const wakingUpProgressFill = document.getElementById("waking-up-progress-fill");
  const downloadActions = document.getElementById("download-actions");
  const stateDownloading = document.getElementById("state-downloading");

  const mediaThumb = document.getElementById("media-thumb");
  const mediaDuration = document.getElementById("media-duration");
  const mediaTitle = document.getElementById("media-title");
  const mediaAuthor = document.getElementById("media-author");
  const mediaQualityBadge = document.getElementById("media-quality-badge");

  const btnQuickDownload = document.getElementById("btn-quick-download");
  const btnQuickText = document.getElementById("btn-quick-text");
  const btnToggleOptions = document.getElementById("btn-toggle-options");
  const optionsPopover = document.getElementById("options-popover");

  const tabVideo = document.getElementById("tab-video");
  const tabAudio = document.getElementById("tab-audio");
  const groupVideoQuality = document.getElementById("group-video-quality");
  const groupAudioQuality = document.getElementById("group-audio-quality");
  const selectVideoQuality = document.getElementById("select-video-quality");
  const selectAudioQuality = document.getElementById("select-audio-quality");
  const chkSaveDefault = document.getElementById("chk-save-default");

  const downloadStatusLabel = document.getElementById("download-status-label");
  const downloadPct = document.getElementById("download-pct");
  const progressBarFill = document.getElementById("progress-bar-fill");
  const btnCancelDownload = document.getElementById("btn-cancel-download");
  const btnRetryInspect = document.getElementById("btn-retry-inspect");

  const toastEl = document.getElementById("toast");
  const toastMessage = document.getElementById("toast-message");

  // State
  const DEFAULT_CONFIG_URL =
    (typeof self.LOCALDROP_CONFIG !== "undefined" && self.LOCALDROP_CONFIG?.defaultServerUrl) ||
    "http://localhost:3000";

  let currentServerUrl = DEFAULT_CONFIG_URL;
  let activeTabUrl = "";
  let activeMedia = null;
  let activeFormat = "video"; // 'video' | 'audio'
  let activeVideoQuality = "best";
  let activeAudioBitrate = "320";
  let toastTimer = null;
  let downloadAbortController = null;

  // 1. Load preferences
  await loadPreferences();

  // Sync toolbar icon with browser theme
  try {
    const isDarkTheme = window.matchMedia("(prefers-color-scheme: dark)").matches;
    chrome.runtime.sendMessage({ type: "THEME_CHANGED", isDark: isDarkTheme }).catch(() => {});
  } catch {}

  // 2. Query Active Tab & Inspect
  await inspectCurrentTab();

  // -------------------------------------------------------------
  // Settings & Status
  // -------------------------------------------------------------
  btnSettings.addEventListener("click", () => {
    settingsPanel.classList.toggle("hidden");
    inputServerUrl.value = currentServerUrl;
  });

  btnSaveServer.addEventListener("click", async () => {
    const val = inputServerUrl.value.trim().replace(/\/$/, "");
    if (!val) return;
    currentServerUrl = val;
    await chrome.storage.local.set({ serverUrl: val });
    settingsPanel.classList.add("hidden");
    showToast("Server URL updated", "success");
    checkServerHealth();
    inspectCurrentTab();
  });

  async function probeServerOnline(timeoutMs = 3500) {
    try {
      // First attempt fast GET /api/metadata (returns { status: "ok" })
      const res = await fetchWithTimeout(
        `${currentServerUrl}/api/metadata`,
        { method: "GET" },
        timeoutMs
      );
      return res && res.ok && res.status !== 502 && res.status !== 503 && res.status !== 504;
    } catch {
      // Fallback try with OPTIONS
      try {
        const optRes = await fetchWithTimeout(
          `${currentServerUrl}/api/metadata`,
          { method: "OPTIONS" },
          timeoutMs
        );
        return optRes && (optRes.status === 200 || optRes.status === 204);
      } catch {
        return false;
      }
    }
  }

  async function checkServerHealth() {
    serverStatusDot.className = "status-dot status-checking";
    const online = await probeServerOnline(3500);
    if (online) {
      serverStatusDot.className = "status-dot status-online";
      serverStatusDot.title = "Connected to LocalDrop Server";
    } else {
      serverStatusDot.className = "status-dot status-offline";
      serverStatusDot.title = `Server offline or sleeping (${currentServerUrl})`;
    }
    return online;
  }

  // -------------------------------------------------------------
  // Server Wakeup & Tab Inspection
  // -------------------------------------------------------------
  async function fetchWithTimeout(url, options = {}, timeoutMs = 25000) {
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timerId);
      return res;
    } catch (err) {
      clearTimeout(timerId);
      throw err;
    }
  }

  async function waitForServerWakeup() {
    const attempts = WAKEUP_SCHEDULE; // [50, 30, 30]

    for (let i = 0; i < attempts.length; i++) {
      const attemptNum = i + 1;
      const duration = attempts[i];
      let secondsLeft = duration;

      if (wakingUpAttempt) {
        wakingUpAttempt.textContent = `Attempt ${attemptNum} of ${attempts.length}`;
      }
      if (wakingUpSeconds) {
        wakingUpSeconds.textContent = `${secondsLeft}s remaining`;
      }
      if (wakingUpProgressFill) {
        wakingUpProgressFill.style.width = "0%";
      }

      // Live countdown ticker every second
      let ticker = null;
      ticker = setInterval(() => {
        secondsLeft--;
        if (secondsLeft >= 0) {
          if (wakingUpSeconds) wakingUpSeconds.textContent = `${secondsLeft}s remaining`;
          if (wakingUpProgressFill) {
            const pct = Math.min(100, Math.round(((duration - secondsLeft) / duration) * 100));
            wakingUpProgressFill.style.width = `${pct}%`;
          }
        }
      }, 1000);

      // Periodically probe the server during this attempt's duration
      const startTime = Date.now();
      const endTime = startTime + duration * 1000;

      while (Date.now() < endTime) {
        // Fast, lightweight health probe (never triggers heavy yt-dlp)
        const isUp = await probeServerOnline(3000);
        if (isUp) {
          clearInterval(ticker);
          serverStatusDot.className = "status-dot status-online";
          serverStatusDot.title = "Connected to LocalDrop Server";
          return true; // Server is confirmed awake! Break out immediately.
        }

        // Wait 2.5s before next ping in this window
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }

      clearInterval(ticker);
      console.warn(`[LocalDrop] Server wake-up attempt ${attemptNum} timed out without response.`);
    }

    return false; // Server did not wake up after all attempts
  }

  async function inspectCurrentTab() {
    showState("inspecting");
    if (skeletonHint) {
      skeletonHint.textContent = "Connecting to server...";
    }

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url) {
        showState("empty");
        activeUrlDisplay.textContent = "No active page found";
        return;
      }

      activeTabUrl = tab.url;
      activeUrlDisplay.textContent = tab.url;
      activeUrlDisplay.title = tab.url;

      // Ignore internal browser pages
      if (activeTabUrl.startsWith("chrome://") || activeTabUrl.startsWith("edge://") || activeTabUrl.startsWith("about:")) {
        showState("empty");
        return;
      }

      const isLocal = currentServerUrl.includes("localhost") || currentServerUrl.includes("127.0.0.1");

      // Step 1: Fast liveness check to see if server is already awake or sleeping
      let isServerAwake = await probeServerOnline(3500);

      if (!isServerAwake) {
        if (isLocal) {
          serverStatusDot.className = "status-dot status-offline";
          showState("empty");
          showToast(`LocalDrop server offline at ${currentServerUrl}. Run 'pnpm dev'`, "error");
          return;
        }

        // Step 2: Server is asleep on cloud host (Render cold start) -> Show autonomous retry view
        serverStatusDot.className = "status-dot status-checking";
        serverStatusDot.title = "Server sleeping (Render cold start)...";
        showState("waking-up");

        isServerAwake = await waitForServerWakeup();

        if (!isServerAwake) {
          // Cloud server did not respond after all 3 attempts
          serverStatusDot.className = "status-dot status-offline";
          serverStatusDot.title = `Server offline (${currentServerUrl})`;
          showState("empty");
          showToast(`Could not reach LocalDrop server at ${currentServerUrl}. Server did not respond after wake-up retries.`, "error");
          return;
        }
      }

      // Step 3: Server is confirmed online! Now extract media metadata
      serverStatusDot.className = "status-dot status-online";
      serverStatusDot.title = "Connected to LocalDrop Server";

      showState("inspecting");
      if (skeletonHint) {
        skeletonHint.textContent = "Server awake! Extracting media details...";
      }

      let res = null;
      try {
        res = await fetchWithTimeout(
          `${currentServerUrl}/api/metadata`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: activeTabUrl }),
          },
          35000 // Generous 35s timeout so yt-dlp has ample time on cloud containers
        );
      } catch (fetchErr) {
        showState("empty");
        showToast(`Extraction request failed: ${fetchErr.message}`, "error");
        return;
      }

      // Step 4: Handle the metadata response
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        showState("empty");
        showToast(errJson.message || "No downloadable video detected on this page.", "error");
        return;
      }

      const data = await res.json();
      if (!data.media) {
        showState("empty");
        showToast("No media formats available.", "error");
        return;
      }

      activeMedia = data.media;
      renderMedia(data.media);
      showState("media");
    } catch (err) {
      console.warn("Inspect failed:", err);
      showState("empty");
      showToast(err.message || "Failed to inspect page.", "error");
    }
  }

  btnRetryInspect?.addEventListener("click", () => inspectCurrentTab());

  // -------------------------------------------------------------
  // Render Media Card & Quality Dropdowns
  // -------------------------------------------------------------
  function renderMedia(media) {
    mediaTitle.textContent = media.title || "Video";
    mediaAuthor.textContent = media.author || hostFromUrl(activeTabUrl);

    if (media.thumbnail) {
      mediaThumb.src = media.thumbnail;
      mediaThumb.classList.remove("hidden");
    } else {
      mediaThumb.classList.add("hidden");
    }

    mediaDuration.textContent = formatDuration(media.duration);

    // Build video quality options from real detected formats
    populateVideoQualities(media.formats || []);

    updateButtonText();
  }

  function populateVideoQualities(formats) {
    const videoFormats = formats.filter((f) => !f.audioOnly && (f.height || f.label));
    selectVideoQuality.innerHTML = "";

    // Always include "Highest Available" option
    const bestOpt = document.createElement("option");
    bestOpt.value = "best";
    bestOpt.textContent = "Highest Available (Auto)";
    selectVideoQuality.appendChild(bestOpt);

    // Add unique resolutions in descending order
    const seenHeights = new Set();
    const sorted = [...videoFormats].sort((a, b) => (b.height || 0) - (a.height || 0));

    for (const fmt of sorted) {
      const h = fmt.height;
      if (h && !seenHeights.has(h)) {
        seenHeights.add(h);
        const opt = document.createElement("option");
        opt.value = String(fmt.id);
        const sizeStr = fmt.size ? ` (~${formatBytes(fmt.size)})` : "";
        opt.textContent = `${h}p ${fmt.ext || "MP4"}${sizeStr}`;
        selectVideoQuality.appendChild(opt);
      }
    }

    // Set badge to highest format
    const topHeight = sorted[0]?.height;
    if (topHeight) {
      mediaQualityBadge.textContent = `${topHeight}p`;
    } else {
      mediaQualityBadge.textContent = "HD";
    }

    // Restore selected preference if valid
    if (activeVideoQuality !== "best") {
      const match = Array.from(selectVideoQuality.options).find(
        (o) => o.value === activeVideoQuality || o.textContent.startsWith(`${activeVideoQuality}p`)
      );
      if (match) selectVideoQuality.value = match.value;
    }
  }

  // -------------------------------------------------------------
  // Popover Toggle & Options
  // -------------------------------------------------------------
  btnToggleOptions.addEventListener("click", (e) => {
    e.stopPropagation();
    optionsPopover.classList.toggle("hidden");
  });

  // Close popover on click outside
  document.addEventListener("click", (e) => {
    if (!optionsPopover.contains(e.target) && e.target !== btnToggleOptions) {
      optionsPopover.classList.add("hidden");
    }
  });

  // Format Switcher tabs
  tabVideo.addEventListener("click", () => {
    activeFormat = "video";
    tabVideo.classList.add("active");
    tabAudio.classList.remove("active");
    groupVideoQuality.classList.remove("hidden");
    groupAudioQuality.classList.add("hidden");
    updateButtonText();
    persistDefaults();
  });

  tabAudio.addEventListener("click", () => {
    activeFormat = "audio";
    tabAudio.classList.add("active");
    tabVideo.classList.remove("active");
    groupAudioQuality.classList.remove("hidden");
    groupVideoQuality.classList.add("hidden");
    updateButtonText();
    persistDefaults();
  });

  selectVideoQuality.addEventListener("change", () => {
    activeVideoQuality = selectVideoQuality.value;
    updateButtonText();
    persistDefaults();
  });

  selectAudioQuality.addEventListener("change", () => {
    activeAudioBitrate = selectAudioQuality.value;
    updateButtonText();
    persistDefaults();
  });

  function updateButtonText() {
    if (activeFormat === "video") {
      const label = selectVideoQuality.options[selectVideoQuality.selectedIndex]?.text || "Best";
      const shortLabel = label.split(" ")[0];
      btnQuickText.textContent = `Download Video (${shortLabel})`;
    } else {
      btnQuickText.textContent = `Download Audio (${activeAudioBitrate}k MP3)`;
    }
  }

  async function persistDefaults() {
    if (!chkSaveDefault.checked) return;
    await chrome.storage.local.set({
      defaultFormat: activeFormat,
      defaultVideoQuality: activeVideoQuality,
      defaultAudioBitrate: activeAudioBitrate,
    });
  }

  // -------------------------------------------------------------
  // Download Trigger
  // -------------------------------------------------------------
  btnQuickDownload.addEventListener("click", async () => {
    if (!activeMedia) return;
    optionsPopover.classList.add("hidden");
    startDownload();
  });

  async function startDownload() {
    showState("downloading");
    downloadStatusLabel.textContent = activeFormat === "audio" ? "Converting audio to MP3..." : "Fetching video stream...";
    downloadPct.textContent = "Connecting...";
    progressBarFill.style.width = "20%";

    // Resolve format id
    let chosenFormat = null;
    if (activeFormat === "video") {
      if (activeVideoQuality !== "best") {
        chosenFormat = activeMedia.formats.find((f) => String(f.id) === activeVideoQuality);
      }
      if (!chosenFormat) {
        // Fallback to top video format
        chosenFormat = activeMedia.formats.find((f) => !f.audioOnly) || activeMedia.formats[0];
      }
    }

    const payload = {
      serverUrl: currentServerUrl,
      downloadPayload: {
        url: activeMedia.sourceUrl,
        title: activeMedia.title,
        formatId: chosenFormat?.id,
        ext: chosenFormat?.ext,
        protocol: chosenFormat?.protocol,
        hasAudio: chosenFormat?.hasAudio,
        requiresFfmpeg: chosenFormat?.requiresFfmpeg,
        type: activeFormat,
        bitrate: activeAudioBitrate,
      },
      filename: `${safeFilename(activeMedia.title)}.${activeFormat === "audio" ? "mp3" : (chosenFormat?.ext?.toLowerCase() || "mp4")}`,
    };

    progressBarFill.style.width = "50%";
    downloadPct.textContent = "Streaming...";

    chrome.runtime.sendMessage({ type: "TRIGGER_DOWNLOAD", payload }, (response) => {
      if (chrome.runtime.lastError || !response || !response.success) {
        const errMsg = response?.error || chrome.runtime.lastError?.message || "Failed to download media.";
        showToast(errMsg, "error");
        showState("media");
      } else {
        progressBarFill.style.width = "100%";
        downloadPct.textContent = "100%";
        downloadStatusLabel.textContent = "Download complete!";
        showToast("Download started! Saved to Downloads.", "success");
        setTimeout(() => showState("media"), 2200);
      }
    });
  }

  // Listen for wake-up countdown updates from background service worker during download
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "DOWNLOAD_WAKING_UP") {
      downloadStatusLabel.textContent = `Waking up cloud server... (Attempt ${message.attempt} of ${message.maxAttempts})`;
      downloadPct.textContent = `${message.secondsLeft}s`;
      const pct = Math.min(100, Math.round(((message.duration - message.secondsLeft) / message.duration) * 100));
      progressBarFill.style.width = `${pct}%`;
    }
  });

  btnCancelDownload?.addEventListener("click", () => {
    if (downloadAbortController) {
      downloadAbortController.abort();
    }
    showToast("Download cancelled", "info");
    showState("media");
  });

  // -------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------
  function showState(state) {
    stateInspecting.classList.add("hidden");
    stateMedia.classList.add("hidden");
    stateEmpty.classList.add("hidden");
    if (stateWakingUp) stateWakingUp.classList.add("hidden");
    downloadActions.classList.add("hidden");
    stateDownloading.classList.add("hidden");

    if (state === "inspecting") {
      stateInspecting.classList.remove("hidden");
    } else if (state === "media") {
      stateMedia.classList.remove("hidden");
      downloadActions.classList.remove("hidden");
    } else if (state === "empty") {
      stateEmpty.classList.remove("hidden");
    } else if (state === "waking-up") {
      if (stateWakingUp) stateWakingUp.classList.remove("hidden");
    } else if (state === "downloading") {
      stateMedia.classList.remove("hidden");
      stateDownloading.classList.remove("hidden");
    }
  }

  function showToast(msg, type = "info") {
    if (toastTimer) clearTimeout(toastTimer);
    toastMessage.textContent = msg;
    toastEl.className = `toast toast-${type}`;
    toastEl.classList.remove("hidden");
    toastTimer = setTimeout(() => {
      toastEl.classList.add("hidden");
    }, 4000);
  }

  async function loadPreferences() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["serverUrl", "defaultFormat", "defaultVideoQuality", "defaultAudioBitrate"], (res) => {
        if (res.serverUrl) {
          if (
            res.serverUrl.includes("localhost:3000") &&
            !DEFAULT_CONFIG_URL.includes("localhost:3000")
          ) {
            currentServerUrl = DEFAULT_CONFIG_URL;
            chrome.storage.local.set({ serverUrl: DEFAULT_CONFIG_URL });
          } else {
            currentServerUrl = res.serverUrl;
          }
        } else {
          currentServerUrl = DEFAULT_CONFIG_URL;
        }

        if (inputServerUrl) {
          inputServerUrl.placeholder = DEFAULT_CONFIG_URL;
        }

        if (res.defaultFormat) activeFormat = res.defaultFormat;
        if (res.defaultVideoQuality) activeVideoQuality = res.defaultVideoQuality;
        if (res.defaultAudioBitrate) activeAudioBitrate = res.defaultAudioBitrate;

        // Apply to UI
        if (activeFormat === "audio") {
          tabAudio.classList.add("active");
          tabVideo.classList.remove("active");
          groupAudioQuality.classList.remove("hidden");
          groupVideoQuality.classList.add("hidden");
        } else {
          tabVideo.classList.add("active");
          tabAudio.classList.remove("active");
          groupVideoQuality.classList.remove("hidden");
          groupAudioQuality.classList.add("hidden");
        }
        selectAudioQuality.value = activeAudioBitrate;
        resolve();
      });
    });
  }

  function formatDuration(sec) {
    if (!sec) return "--:--";
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function formatBytes(bytes) {
    if (!bytes) return "";
    if (bytes > 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  }

  function hostFromUrl(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "web"; }
  }

  function safeFilename(name) {
    if (!name) return "download";
    return name.replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, " ").trim().slice(0, 120);
  }
});

