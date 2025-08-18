// --- UI Helpers ---
const qs = (sel) => document.querySelector(sel);
const rowsEl = qs("#rows");
const embedCodeEl = qs("#embedCode");
const pulsePlayer = qs("#pulsePlayerContainer");
const toastEl = qs("#toast");
const state = { items: [], selectedId: null };

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 3000);
}

function createRow(item) {
  const row = document.createElement("div");
  row.className = "row";
  row.dataset.id = item.id;
  row.innerHTML = `
      <div class="file-ico" aria-hidden="true">🎵</div>
      <div>
        <div style="word-break: break-word;" class="name" title="${
          item.file.name
        }">${item.file.name}</div>
        <div class="meta">${item.file.type || "audio/mpeg"} • ${formatBytes(
    item.file.size
  )}</div>
        <div class="progress"><div class="bar" style="width:${
          item.progress * 100
        }%"></div></div>
      </div>
      <div class="actions">
        <button class="btn btn-sm copy" title="Copy link" ${
          item.url ? "" : "disabled"
        }>Copy 🔗</button>
        <button class="btn btn-sm remove" title="Remove">🗑️</button>
      </div>`;

  const copyBtn = row.querySelector(".copy");
  const removeBtn = row.querySelector(".remove");

  row.addEventListener("click", (e) => {
    if (e.target.closest("button")) return;
    selectItem(item.id);
  });

  copyBtn.addEventListener("click", async () => {
    if (!item.url) return;
    await navigator.clipboard.writeText(item.url);
    showToast("Link copied");
  });

  removeBtn.addEventListener("click", () => {
    state.items = state.items.filter((x) => x.id !== item.id);
    if (state.selectedId === item.id) {
      state.selectedId = null;
      embedCodeEl.textContent =
        "Select or upload a file to see its embed code.";
      qs("#openLink").disabled = true;
    }
    row.remove();
  });

  return { row };
}

function render() {
  rowsEl.innerHTML = "";
  state.items.forEach((item) => {
    const { row } = createRow(item);
    rowsEl.appendChild(row);
  });
}

function updateRowProgress(id, value) {
  const el = rowsEl.querySelector(`[data-id="${id}"] .bar`);
  if (el) el.style.width = (value * 100).toFixed(1) + "%";
}

function selectItem(id) {
  state.selectedId = id;
  const item = state.items.find((i) => i.id === id);
  if (!item || !item.url) return;

  // Update the embed code preview
  const code = `<audio controls>
  <source src="${item.url}" type="audio/mpeg">
  Your browser does not support the audio element.
</audio>`;
  embedCodeEl.textContent = code;

 
// PULSE PLAYER HANDLER
// --- Inject the HTML + CSS only ---
const url = new URL(item.url);
const pathname = url.pathname;
const filename = pathname.substring(pathname.lastIndexOf("/") + 1);

const playerUrl = `${item.url}`;
pulsePlayer.innerHTML = `
  <style>
    .pulse-audio-player { max-width: 350px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif; user-select: none; color: #222; background: #fff; border-radius: 14px; padding: 18px 22px; box-sizing: border-box; border: 1px solid #ccc; } .track-info { margin-bottom: 14px; } .title { font-weight: 600; font-size: 1.2rem; line-height: 1.2; color: #2b2b2b; } .artist { font-weight: 400; color: #666; font-size: 0.9rem; line-height: 1.2; margin-top: 2px; } .player-row { display: flex; align-items: center; gap: 18px; } /* Play button with subtle pulse ring */ .play-pause { position: relative; background: #4caf50; border: none; border-radius: 50%; width: 52px; height: 52px; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 12px #4caf5077; transition: background 0.3s ease; } .play-pause:hover, .play-pause:focus { background: #66bb6a; outline: none; box-shadow: 0 0 18px #4caf50bb; } .play-pause:active { background: #388e3c; box-shadow: 0 0 8px #2a652bbb; } .play-pause svg { pointer-events: none; } .pulse-ring { position: absolute; top: 50%; left: 50%; width: 68px; height: 68px; border-radius: 50%; background: rgba(76, 175, 80, 0.3); transform: translate(-50%, -50%) scale(1); opacity: 0; pointer-events: none; transition: opacity 0.4s ease; animation: pulse 1.8s infinite ease-in-out; } /* Animate pulse only when playing */ .play-pause.playing .pulse-ring { opacity: 1; } @keyframes pulse { 0% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; } 50% { transform: translate(-50%, -50%) scale(1.3); opacity: 0; } 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; } } /* Progress bar container */ .progress-container { position: relative; flex-grow: 1; height: 10px; border-radius: 6px; background: #e8e8e8; cursor: pointer; } .progress-bar { position: absolute; top: 0; left: 0; height: 10px; border-radius: 6px 0 0 6px; background: #4caf50; width: 0; transition: width 0.1s linear; } .progress-handle { position: absolute; top: 50%; transform: translate(-50%, -50%); width: 18px; height: 18px; border-radius: 50%; background: #4caf50; border: 2px solid #fff; box-shadow: 0 0 8px #4caf5066; cursor: pointer; transition: background-color 0.3s ease; } .progress-container:hover .progress-handle, .progress-handle:focus { background: #66bb6a; outline: none; } .time-container { min-width: 75px; font-variant-numeric: tabular-nums; font-size: 0.9rem; color: #555; user-select: none; } /* Volume controls */ .volume-container { display: flex; align-items: center; gap: 8px; } .mute-button { background: transparent; border: none; color: #666; cursor: pointer; transition: color 0.3s ease; padding: 0; } .mute-button:hover, .mute-button:focus { color: #4caf50; outline: none; } .mute-button svg { pointer-events: none; } #volume { width: 80px; height: 6px; -webkit-appearance: none; background: #ddd; border-radius: 3px; cursor: pointer; } #volume::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px; background: #4caf50; border-radius: 50%; cursor: pointer; box-shadow: 0 0 8px #4caf5066; transition: background-color 0.3s ease; margin-top: -4px; } #volume:hover::-webkit-slider-thumb, #volume:focus::-webkit-slider-thumb { background: #66bb6a; outline: none; box-shadow: 0 0 12px #4caf5077; } #volume::-moz-range-thumb { width: 14px; height: 14px; background: #4caf50; border-radius: 50%; cursor: pointer; box-shadow: 0 0 8px #4caf5066; transition: background-color 0.3s ease; } #volume:hover::-moz-range-thumb, #volume:focus::-moz-range-thumb { background: #66bb6a; outline: none; box-shadow: 0 0 12px #4caf5077; }
  </style>

  <div class="pulse-audio-player" role="region" aria-label="Audio player with pulse ring and clean design" tabindex="0">
    <div class="track-info" aria-live="polite">
      <div class="title" id="title">${filename || "Unknown Title"}</div>
      <div class="artist" id="artist">${item.artist || "Unknown Artist"}</div>
    </div>

    <div class="player-row">
      <button class="play-pause" id="play-pause" aria-label="Play" title="Play/Pause" aria-pressed="false">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round">
          <polygon points="6 4 20 12 6 20"></polygon>
        </svg>
        <span class="pulse-ring"></span>
      </button>

      <div class="progress-container" id="progress-container" role="slider" tabindex="0" aria-label="Audio progress bar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
        <div class="progress-bar" id="progress-bar"></div>
        <div class="progress-handle" id="progress-handle" style="left: 0%;"></div>
      </div>

      <div class="time-container">
        <span class="current-time" id="current-time">0:00</span> /
        <span class="duration" id="duration">0:00</span>
      </div>

      <div class="volume-container">
        <button class="mute-button" id="mute-button" aria-label="Mute audio" title="Mute/Unmute">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
            <polygon points="3 9 9 9 13 5 13 19 9 15 3 15 3 9"></polygon>
            <path d="M16 12a4 4 0 0 1 0 0"></path>
          </svg>
        </button>
        <input type="range" id="volume" aria-label="Volume slider" min="0" max="1" step="0.01" value="1" />
      </div>
    </div>

    <audio id="audio" preload="metadata" tabindex="-1">
      <source id="audio-source" src="${playerUrl}" type="audio/mpeg" />
      Your browser does not support the audio element.
    </audio>
  </div>
`;

// --- Injecting Dynamic Script ---
const script = document.createElement("script");
script.textContent = `

function loadNewTrack(fileUrl) {
  const audio = document.getElementById("audio");
  const source = document.getElementById("audio-source");
  if (!audio || !source) return;
  source.src = fileUrl;
  audio.load();
  audio.play().catch(() => {}); // avoid autoplay errors
}

function initPulsePlayer() {
  const audio = document.getElementById("audio");
  const playPause = document.getElementById("play-pause");
  const currentTimeEl = document.getElementById("current-time");
  const durationEl = document.getElementById("duration");
  const progressContainer = document.getElementById("progress-container");
  const progressBar = document.getElementById("progress-bar");
  const progressHandle = document.getElementById("progress-handle");
  const volumeInput = document.getElementById("volume");
  const muteButton = document.getElementById("mute-button");

  if (!audio || !playPause) {
    console.error("Player elements not found. Did you inject the HTML?");
    return;
  }

  let dragging = false;

  function formatTime(time) {
    if (isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return mins + ":" + (secs < 10 ? "0" : "") + secs;
  }

  function updatePlayPause() {
    const svg = playPause.querySelector("svg");
    if (audio.paused) {
      playPause.setAttribute("aria-label", "Play");
      playPause.title = "Play";
      playPause.setAttribute("aria-pressed", "false");
      svg.innerHTML = '<polygon points="6 4 20 12 6 20"></polygon>';
      playPause.classList.remove("playing");
    } else {
      playPause.setAttribute("aria-label", "Pause");
      playPause.title = "Pause";
      playPause.setAttribute("aria-pressed", "true");
      svg.innerHTML =
        '<rect x="6" y="4" width="4" height="16"></rect>' +
        '<rect x="14" y="4" width="4" height="16"></rect>';
      playPause.classList.add("playing");
    }
  }

  function updateProgress() {
    if (!audio.duration) return;
    const percent = (audio.currentTime / audio.duration) * 100;
    progressBar.style.width = percent + "%";
    progressHandle.style.left = percent + "%";
    progressContainer.setAttribute("aria-valuenow", Math.floor(percent));
    currentTimeEl.textContent = formatTime(audio.currentTime);
  }

  function seek(positionX) {
    const rect = progressContainer.getBoundingClientRect();
    let x = positionX - rect.left;
    x = Math.min(rect.width, Math.max(0, x));
    const percent = x / rect.width;
    audio.currentTime = percent * audio.duration;
  }

  // Events
  playPause.addEventListener("click", () => {
    if (audio.paused) audio.play();
    else audio.pause();
  });

  audio.addEventListener("play", updatePlayPause);
  audio.addEventListener("pause", updatePlayPause);
  audio.addEventListener("timeupdate", () => {
    if (!dragging) updateProgress();
  });
  audio.addEventListener("loadedmetadata", () => {
    durationEl.textContent = formatTime(audio.duration);
    updateProgress();
    volumeInput.value = audio.volume;
  });

  progressContainer.addEventListener("mousedown", (e) => {
    dragging = true;
    seek(e.clientX);
  });
  window.addEventListener("mousemove", (e) => {
    if (dragging) seek(e.clientX);
  });
  window.addEventListener("mouseup", () => {
    dragging = false;
  });

  progressContainer.addEventListener("keydown", (e) => {
    if (!audio.duration) return;
    const step = audio.duration * 0.05;
    if (["ArrowRight", "ArrowUp"].includes(e.key)) {
      audio.currentTime = Math.min(audio.duration, audio.currentTime + step);
      e.preventDefault();
    } else if (["ArrowLeft", "ArrowDown"].includes(e.key)) {
      audio.currentTime = Math.max(0, audio.currentTime - step);
      e.preventDefault();
    } else if (e.key === "Home") {
      audio.currentTime = 0;
      e.preventDefault();
    } else if (e.key === "End") {
      audio.currentTime = audio.duration;
      e.preventDefault();
    }
  });

  volumeInput.addEventListener("input", (e) => {
    audio.volume = e.target.value;
    muteButton.setAttribute("aria-label", audio.volume === 0 ? "Unmute" : "Mute");
    muteButton.title = audio.volume === 0 ? "Unmute" : "Mute";
  });

  muteButton.addEventListener("click", () => {
    if (audio.volume > 0) {
      audio.volume = 0;
      volumeInput.value = 0;
      muteButton.setAttribute("aria-label", "Unmute");
      muteButton.title = "Unmute";
    } else {
      audio.volume = 0.5;
      volumeInput.value = 0.5;
      muteButton.setAttribute("aria-label", "Mute");
      muteButton.title = "Mute";
    }
  });

  updatePlayPause();
}

document.addEventListener("DOMContentLoaded", () => {
  initPulsePlayer();
  const params = new URLSearchParams(window.location.search);
  const fileUrl = params.get("file");
  if (fileUrl) loadNewTrack(fileUrl);
});
`;

// attach script so it runs
document.body.appendChild(script);

// init now for selected track
initPulsePlayer();
loadNewTrack(item.url);

qs("#copyPulseCode").addEventListener("click", async () => {
  const playerCode = pulsePlayer.innerHTML.trim(); 
  if (!playerCode) return;
  const pulseCode = pulsePlayer.appendChild(script);
  await navigator.clipboard.writeText(pulseCode);
  showToast("Embed code copied");
});

  qs("#openLink").disabled = false;
  qs("#openLink").onclick = () => window.open(item.url, "_blank");
  embedCodeEl.focus();
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024,
    sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(2) + " " + sizes[i];
}

async function handleFiles(files) {
  for (const file of files) {
    if (file.type !== "audio/mpeg") {
      showToast("Only MP3 (audio/mpeg) files are allowed");
      continue;
    }
    if (file.size > MAX_SIZE) {
      showToast("File too large (max 4.5 MB)");
      continue;
    }

    const id = crypto.randomUUID();
    const item = { id, file, progress: 0, url: null };
    state.items.unshift(item);
    render();

    try {
      const res = await uploadToServer(file, (p) => {
        item.progress = p;
        updateRowProgress(id, p);
      });
      item.url = res.url;
      item.progress = 1;
      updateRowProgress(id, 1);

      const row = rowsEl.querySelector(`[data-id="${id}"]`);
      if (row) {
        const copy = row.querySelector(".copy");
        if (copy) copy.disabled = false;
      }

      selectItem(id);
      showToast("Upload complete");
    } catch (err) {
      console.error(err);

      let msg = "Upload failed";

      if (err.message) {
        msg = err.message;
      } else if (typeof err === "string") {
        msg = err;
      } else if (err.response) {
        // if err has response property (e.g. from fetch)
        msg = `Upload failed: ${err.response.status} ${err.response.statusText}`;
      }

      showToast(msg);
    }
  }
}

// --- Event bindings ---
const dz = qs("#dropzone");
const input = qs("#fileInput");
input.addEventListener("change", (e) => handleFiles(e.target.files));

["dragenter", "dragover"].forEach((ev) =>
  dz.addEventListener(ev, (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    dz.classList.add("drag");
  })
);
["dragleave", "drop"].forEach((ev) =>
  dz.addEventListener(ev, (e) => {
    e.preventDefault();
    dz.classList.remove("drag");
  })
);
dz.addEventListener("drop", (e) => {
  handleFiles(e.dataTransfer.files);
});

window.addEventListener("paste", (e) => {
  const files = [...(e.clipboardData?.files || [])];
  if (files.length) handleFiles(files);
});

qs("#copyCode").addEventListener("click", async () => {
  const code = embedCodeEl.textContent.trim();
  if (!code) return;
  await navigator.clipboard.writeText(code);
  showToast("Embed code copied");
});


const themeBtn = qs("#themeToggle");
themeBtn.addEventListener("click", () => {
  document.documentElement.classList.toggle("light");
});

qs("#infoButton").addEventListener("click", () =>
  qs("#infoDialog").showModal()
);
