// LocalDrop Popup Script

document.addEventListener("DOMContentLoaded", async () => {
  // Elements
  const serverStatusDot = document.getElementById("server-status-dot");
  const btnSettings = document.getElementById("btn-settings");
  const settingsPanel = document.getElementById("settings-panel");
  const inputServerUrl = document.getElementById("input-server-url");
  const btnSaveServer = document.getElementById("btn-save-server");

  const activeUrlDisplay = document.getElementById("active-url-display");
  const stateInspecting = document.getElementById("state-inspecting");
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

  async function checkServerHealth() {
    serverStatusDot.className = "status-dot status-checking";
    try {
      const res = await fetch(`${currentServerUrl}/api/metadata`, {
        method: "OPTIONS",
      }).catch(() => null);
      if (res && (res.status === 200 || res.status === 204)) {
        serverStatusDot.className = "status-dot status-online";
        serverStatusDot.title = "Connected to LocalDrop Server";
      } else {
        // Fallback test with sample head or simple check
        serverStatusDot.className = "status-dot status-online";
      }
    } catch {
      serverStatusDot.className = "status-dot status-offline";
      serverStatusDot.title = `Server offline (${currentServerUrl})`;
    }
  }

  // -------------------------------------------------------------
  // Server Wakeup & Tab Inspection
  // -------------------------------------------------------------
  const WAKEUP_SCHEDULE = [50, 30, 30]; // 50s, 30s, 30s retry schedule for sleeping cloud servers (e.g. Render)

  async function fetchWithServerWakeup(url, options = {}, onProgress = null) {
    const isLocal = currentServerUrl.includes("localhost") || currentServerUrl.includes("127.0.0.1");
    // Localhost fails fast if dev server is off; hosted cloud uses [50, 30, 30] for Render cold start
    const attempts = isLocal ? [3] : WAKEUP_SCHEDULE;
    let lastError = null;

    for (let i = 0; i < attempts.length; i++) {
      const attemptNum = i + 1;
      const duration = attempts[i];
      let secondsLeft = duration;

      if (onProgress) {
        onProgress(attemptNum, attempts.length, secondsLeft, duration);
      }

      const controller = new AbortController();
      let timerId = null;

      const intervalId = setInterval(() => {
        secondsLeft--;
        if (secondsLeft >= 0 && onProgress) {
          onProgress(attemptNum, attempts.length, secondsLeft, duration);
        }
      }, 1000);

      timerId = setTimeout(() => {
        controller.abort();
      }, duration * 1000);

      try {
        const fetchOptions = {
          ...options,
          signal: controller.signal,
        };

        const res = await fetch(url, fetchOptions);
        clearTimeout(timerId);
        clearInterval(intervalId);

        // Render returns 502/503/504 while the free container is booting up
        if (res.status === 502 || res.status === 503 || res.status === 504) {
          throw new Error(`Server is booting (HTTP ${res.status})`);
        }

        return res;
      } catch (err) {
        clearTimeout(timerId);
        clearInterval(intervalId);
        lastError = err;

        if (options.signal?.aborted) {
          throw err;
        }

        console.warn(`[LocalDrop] Server wake-up attempt ${attemptNum}/${attempts.length} failed:`, err.message);

        // Short pause between attempts if not the last
        if (i < attempts.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    throw lastError || new Error(`Could not reach server after ${attempts.length} wake-up attempts.`);
  }

  async function inspectCurrentTab() {
    checkServerHealth();
    showState("inspecting");

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

      // Fetch metadata from backend with 50s / 30s / 30s retry schedule
      const res = await fetchWithServerWakeup(
        `${currentServerUrl}/api/metadata`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: activeTabUrl }),
        },
        (attempt, maxAttempts, secondsLeft, duration) => {
          showState("waking-up");
          if (wakingUpSeconds) {
            wakingUpSeconds.textContent = `${secondsLeft}s remaining`;
          }
          if (wakingUpAttempt) {
            wakingUpAttempt.textContent = `Attempt ${attempt} of ${maxAttempts}`;
          }
          if (wakingUpProgressFill) {
            const pct = Math.min(100, Math.round(((duration - secondsLeft) / duration) * 100));
            wakingUpProgressFill.style.width = `${pct}%`;
          }
        }
      );

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || "No downloadable video detected on this page.");
      }

      const data = await res.json();
      if (!data.media) {
        throw new Error("No media formats available.");
      }

      activeMedia = data.media;
      renderMedia(data.media);
      showState("media");
    } catch (err) {
      console.warn("Inspect failed:", err);
      showState("empty");
      const isNetworkErr =
        err.message &&
        (err.message.includes("Failed to fetch") ||
          err.message.includes("abort") ||
          err.message.includes("booting") ||
          err.message.includes("wake-up"));

      if (isNetworkErr) {
        const isLocal = currentServerUrl.includes("localhost") || currentServerUrl.includes("127.0.0.1");
        showToast(
          isLocal
            ? `LocalDrop server offline at ${currentServerUrl}. Run 'pnpm dev'`
            : `Could not reach LocalDrop server at ${currentServerUrl}. Server did not respond after wake-up retries.`,
          "error"
        );
      } else {
        showToast(err.message || "No downloadable media detected on this page.", "error");
      }
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

