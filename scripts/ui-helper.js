// --- UI Helpers ---
const qs = (sel) => document.querySelector(sel);
const rowsEl = qs("#rows");
const embedCodeEl = qs("#embedCode");
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

  // Inject custom player HTML
  const playerUrl = `${item.url}`;
  qs("#pulsePlayerContainer").innerHTML = `
    <div class="pulse-audio-player" role="region" aria-label="Audio player with pulse ring and clean design" tabindex="0">
      <div class="track-info" aria-live="polite">
        <div class="title" id="title">${item.fileName || "Unknown Title"}</div>
        <div class="artist" id="artist">${item.artist || "Unknown Artist"}</div>
      </div>

      <div class="player-row">
        <button class="play-pause" id="play-pause" aria-label="Play" title="Play/Pause" aria-pressed="false">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round">
            <polygon points="6 4 20 12 6 20" />
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

  // 🔹 Initialize the custom player logic AFTER injecting HTML
  initPulsePlayer();

  // 🔹 Load the selected track into the player
  loadNewTrack(item.url);

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
