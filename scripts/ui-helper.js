// --- DOM helpers ---
function qs(sel) {
  return document.querySelector(sel);
}
function qsa(sel) {
  return document.querySelectorAll(sel);
}

// --- File handler ---
async function handleFiles(files) {
  for (let file of files) {
    console.log("Selected file:", file.name, file.size);

    const progressContainer = qs("#progressContainer");
    if (progressContainer) {
      progressContainer.style.display = "block";
    }

    try {
      // Upload to Render with browser progress tracking
      const { uploadId, fileUrl } = await uploadToServer(
        file,
        (browserProgress) => {
          const percent = Math.round(browserProgress * 100);

          const browserProgressEl = qs("#browserProgress");
          const browserProgressText = qs("#browserProgressText");

          if (browserProgressEl) browserProgressEl.value = percent;
          if (browserProgressText)
            browserProgressText.textContent = `${percent}%`;
        }
      );

      // Poll backend for server-side progress
      const poll = setInterval(async () => {
        try {
          const res = await fetch(
            `https://onestop-pqio.onrender.com/progress/${uploadId}`
          );
          const data = await res.json();

          if (data.progress !== undefined) {
            const percent = Math.round(data.progress * 100);

            const serverProgressEl = qs("#serverProgress");
            const serverProgressText = qs("#serverProgressText");

            if (serverProgressEl) serverProgressEl.value = percent;
            if (serverProgressText)
              serverProgressText.textContent = `${percent}%`;

           if (percent >= 100) {
  clearInterval(poll);
  console.log("✅ Upload complete:", fileUrl);

  // --- Build Embed Code (TEXT ONLY) ---
  const embedHtml = `<audio controls>
  <source src="${fileUrl}" type="audio/mpeg">
  Your browser does not support the audio element.
</audio>`;

  const embedCodeEl = qs("#embedCode");
  if (embedCodeEl) {
    embedCodeEl.textContent = embedHtml; // shows raw HTML as text
  }

  // Enable open link button
  const openBtn = qs("#openLink");
  if (openBtn) {
    openBtn.disabled = false;
    openBtn.onclick = () => window.open(fileUrl, "_blank");
  }

  // --- Build Pulse Player (ACTUAL PLAYER) ---
  const pulseHtml = `
    <div id="pulse-player">
  <style>
    .pulse-audio-player { max-width: 350px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif; user-select: none; color: #222; background: #fff; border-radius: 14px; padding: 18px 22px; box-sizing: border-box; border: 1px solid #ccc; }
    .track-info { margin-bottom: 14px; }
    .title { font-weight: 600; font-size: 1.2rem; line-height: 1.2; color: #2b2b2b; }
    .artist { font-weight: 400; color: #666; font-size: 0.9rem; line-height: 1.2; margin-top: 2px; }
    .player-row { display: flex; align-items: center; gap: 18px; }
    .play-pause { position: relative; background: #4caf50; border: none; border-radius: 50%; width: 52px; height: 52px; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 12px #4caf5077; transition: background 0.3s ease; }
    .play-pause:hover, .play-pause:focus { background: #66bb6a; outline: none; box-shadow: 0 0 18px #4caf50bb; }
    .play-pause:active { background: #388e3c; box-shadow: 0 0 8px #2a652bbb; }
    .play-pause svg { pointer-events: none; }
    .pulse-ring { position: absolute; top: 50%; left: 50%; width: 68px; height: 68px; border-radius: 50%; background: rgba(76, 175, 80, 0.3); transform: translate(-50%, -50%) scale(1); opacity: 0; pointer-events: none; transition: opacity 0.4s ease; animation: pulse 1.8s infinite ease-in-out; }
    .play-pause.playing .pulse-ring { opacity: 1; }
    @keyframes pulse { 0% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; } 50% { transform: translate(-50%, -50%) scale(1.3); opacity: 0; } 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; } }
    .progress-container { position: relative; flex-grow: 1; height: 10px; border-radius: 6px; background: #e8e8e8; cursor: pointer; }
    .progress-bar { position: absolute; top: 0; left: 0; height: 10px; border-radius: 6px 0 0 6px; background: #4caf50; width: 0; transition: width 0.1s linear; }
    .progress-handle { position: absolute; top: 50%; transform: translate(-50%, -50%); width: 18px; height: 18px; border-radius: 50%; background: #4caf50; border: 2px solid #fff; box-shadow: 0 0 8px #4caf5066; cursor: pointer; transition: background-color 0.3s ease; }
    .progress-container:hover .progress-handle, .progress-handle:focus { background: #66bb6a; outline: none; }
    .time-container { min-width: 75px; font-variant-numeric: tabular-nums; font-size: 0.9rem; color: #555; user-select: none; }
    .volume-container { display: flex; align-items: center; gap: 8px; }
    .mute-button { background: transparent; border: none; color: #666; cursor: pointer; transition: color 0.3s ease; padding: 0; }
    .mute-button:hover, .mute-button:focus { color: #4caf50; outline: none; }
    .mute-button svg { pointer-events: none; }
    #volume { width: 80px; height: 6px; -webkit-appearance: none; background: #ddd; border-radius: 3px; cursor: pointer; }
    #volume::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px; background: #4caf50; border-radius: 50%; cursor: pointer; box-shadow: 0 0 8px #4caf5066; transition: background-color 0.3s ease; margin-top: -4px; }
    #volume:hover::-webkit-slider-thumb, #volume:focus::-webkit-slider-thumb { background: #66bb6a; outline: none; box-shadow: 0 0 12px #4caf5077; }
    #volume::-moz-range-thumb { width: 14px; height: 14px; background: #4caf50; border-radius: 50%; cursor: pointer; box-shadow: 0 0 8px #4caf5066; transition: background-color 0.3s ease; }
    #volume:hover::-moz-range-thumb, #volume:focus::-moz-range-thumb { background: #66bb6a; outline: none; box-shadow: 0 0 12px #4caf5077; }
  </style>

  <div class="pulse-audio-player" role="region" aria-label="Audio player with pulse ring and clean design" tabindex="0">
    <div class="track-info" aria-live="polite">
      <div class="title" id="title">Unknown Title</div>
      <div class="artist" id="artist">Unknown Artist</div>
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
      <source id="audio-source" src="" type="audio/mpeg" />
      Your browser does not support the audio element.
    </audio>
  </div>
</div>

<script>
function loadNewTrack(fileUrl, title = "Unknown Title", artist = "Unknown Artist") {
  const audio = document.getElementById("audio");
  const source = document.getElementById("audio-source");
  const titleEl = document.getElementById("title");
  const artistEl = document.getElementById("artist");
  if (!audio || !source) return;
  source.src = fileUrl;
  audio.load();
  audio.play().catch(() => {});
  if (titleEl) titleEl.textContent = title;
  if (artistEl) artistEl.textContent = artist;
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
  if (!audio || !playPause) return;

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
      svg.innerHTML = '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
      playPause.classList.add("playing");
    }
  }

  function updateProgress() {
    if (!dragging) {
      const percent = (audio.currentTime / audio.duration) * 100 || 0;
      progressBar.style.width = percent + "%";
      progressHandle.style.left = percent + "%";
      if (currentTimeEl) currentTimeEl.textContent = formatTime(audio.currentTime);
      if (durationEl) durationEl.textContent = formatTime(audio.duration);
      progressContainer.setAttribute("aria-valuenow", Math.floor(percent));
    }
  }

  function setProgress(e) {
    const rect = progressContainer.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const percent = Math.min(Math.max(offsetX / rect.width, 0), 1);
    audio.currentTime = percent * audio.duration;
  }

  playPause.addEventListener("click", () => {
    if (audio.paused) audio.play(); else audio.pause();
    updatePlayPause();
  });

  audio.addEventListener("play", updatePlayPause);
  audio.addEventListener("pause", updatePlayPause);
  audio.addEventListener("timeupdate", updateProgress);
  audio.addEventListener("loadedmetadata", updateProgress);

  progressContainer.addEventListener("mousedown", e => { dragging = true; setProgress(e); });
  document.addEventListener("mousemove", e => { if (dragging) setProgress(e); });
  document.addEventListener("mouseup", () => { dragging = false; });

  progressContainer.addEventListener("keydown", e => {
    if (e.key === "ArrowRight") { audio.currentTime = Math.min(audio.currentTime + 5, audio.duration); updateProgress(); e.preventDefault(); }
    if (e.key === "ArrowLeft") { audio.currentTime = Math.max(audio.currentTime - 5, 0); updateProgress(); e.preventDefault(); }
  });

  volumeInput.addEventListener("input", e => { audio.volume = parseFloat(e.target.value); audio.muted = false; });
  muteButton.addEventListener("click", () => { audio.muted = !audio.muted; muteButton.setAttribute("aria-label", audio.muted ? "Unmute audio" : "Mute audio"); });

  updatePlayPause();
}

document.addEventListener("DOMContentLoaded", initPulsePlayer);
</script>

  `;
  const pulseContainer = qs("#pulsePlayerContainer");
  if (pulseContainer) {
    pulseContainer.innerHTML = pulseHtml; // renders live player
  }

  // Save code for Copy buttons
  window._lastEmbedCode = embedHtml;
  window._lastPulseCode = pulseHtml;
}

          }
        } catch (err) {
          console.error("Polling error:", err);
          clearInterval(poll);
        }
      }, 1000);
    } catch (err) {
      console.error("Upload error:", err);
      alert("Upload failed: " + err.message);
    }
  }
}

// --- Upload function ---
const MAX_SIZE = 100 * 1024 * 1024; // 100 MB

async function uploadToServer(file, onProgress) {
  if (!file) throw new Error("No file provided");
  if (file.size > MAX_SIZE)
    throw new Error(`File exceeds max size of ${MAX_SIZE} bytes`);

  const formData = new FormData();
  formData.append("file", file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "https://onestop-pqio.onrender.com/upload", true);

    // Progress event handler for upload
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && typeof onProgress === "function") {
        onProgress(event.loaded / event.total); // fraction from 0 to 1
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          if (response.success) {
            resolve({ uploadId: response.uploadId, fileUrl: response.fileUrl });
          } else {
            reject(
              new Error("Upload failed: " + (response.error || "unknown error"))
            );
          }
        } catch (parseError) {
          reject(new Error("Invalid JSON response from server"));
        }
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.responseText}`));
      }
    };

    xhr.onerror = () => reject(new Error("Upload failed (network error)"));

    xhr.send(formData);
  });
}

// --- Event bindings ---
document.addEventListener("DOMContentLoaded", () => {
  const dz = qs("#dropzone");
  const input = qs("#fileInput");
  const uploadBtn = qs("#uploadBtn");

  if (input) {
    input.addEventListener("change", (e) => handleFiles(e.target.files));
  }

  if (dz) {
    ["dragenter", "dragover"].forEach((evt) =>
      dz.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dz.classList.add("dragging");
      })
    );
    ["dragleave", "drop"].forEach((evt) =>
      dz.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dz.classList.remove("dragging");
      })
    );
    dz.addEventListener("drop", (e) => {
      if (e.dataTransfer.files.length) {
        handleFiles(e.dataTransfer.files);
      }
    });
  }

  if (uploadBtn && input) {
    uploadBtn.addEventListener("click", () => {
      if (input.files.length) {
        handleFiles(input.files);
      } else {
        alert("Please choose a file first!");
      }
    });
  }
});
