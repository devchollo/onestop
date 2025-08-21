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

    qs("#progressContainer").style.display = "block";

    try {
      // Upload to Render with browser progress tracking
      const { uploadId, fileUrl } = await uploadToServer(
        file,
        (browserProgress) => {
          const percent = Math.round(browserProgress * 100);
          qs("#browserProgress").value = percent;
          qs("#browserProgressText").textContent = `${percent}%`;
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
            qs("#serverProgress").value = percent;
            qs("#serverProgressText").textContent = `${percent}%`;

            if (percent >= 100) {
              clearInterval(poll);
              console.log("✅ Upload complete:", fileUrl);
              alert(`Upload complete!\nFile URL: ${fileUrl}`);
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
    ;["dragenter", "dragover"].forEach((evt) =>
      dz.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dz.classList.add("dragging");
      })
    );
    ;["dragleave", "drop"].forEach((evt) =>
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
