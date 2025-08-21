// server.js
import express from "express";
import multer from "multer";
import fs from "fs";
import fetch from "node-fetch";
import { v4 as uuidv4 } from "uuid";

const app = express();
const upload = multer({ dest: "/tmp/" });

// In-memory progress store (id -> %)
const progressMap = new Map();

// --- SSE route for progress updates ---
app.get("/progress/:id", (req, res) => {
  const { id } = req.params;
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const interval = setInterval(() => {
    const percent = progressMap.get(id) || 0;
    res.write(`data: ${percent}\n\n`);
    if (percent >= 100) {
      clearInterval(interval);
      res.end();
    }
  }, 1000);
});

// --- Backblaze helpers ---
async function b2AuthorizeAccount() {
  const { B2_KEY_ID, B2_APP_KEY } = process.env;
  if (!B2_KEY_ID || !B2_APP_KEY) throw new Error("B2_KEY_ID or B2_APP_KEY not set");

  const credentials = Buffer.from(`${B2_KEY_ID}:${B2_APP_KEY}`).toString("base64");
  const res = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
    headers: { Authorization: `Basic ${credentials}` },
  });
  if (!res.ok) throw new Error("B2 authorize failed");
  return res.json();
}

async function b2GetUploadUrl(apiUrl, authorizationToken, bucketId) {
  const res = await fetch(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
    method: "POST",
    headers: { Authorization: authorizationToken, "Content-Type": "application/json" },
    body: JSON.stringify({ bucketId }),
  });
  if (!res.ok) throw new Error("B2 get upload URL failed");
  return res.json();
}

// --- Upload route ---
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const { B2_BUCKET_ID, B2_BUCKET_NAME } = process.env;
    if (!B2_BUCKET_ID || !B2_BUCKET_NAME) {
      return res.status(500).json({ error: "B2_BUCKET_ID or B2_BUCKET_NAME not set" });
    }

    const uploadId = uuidv4(); // unique id per upload
    progressMap.set(uploadId, 0);

    // authorize + get upload URL
    const { apiUrl, authorizationToken, downloadUrl } = await b2AuthorizeAccount();
    const { uploadUrl, authorizationToken: uploadAuthToken } = await b2GetUploadUrl(
      apiUrl,
      authorizationToken,
      B2_BUCKET_ID
    );

    // Track stream progress
    const totalSize = req.file.size;
    let uploaded = 0;

    const fileStream = fs.createReadStream(req.file.path);
    fileStream.on("data", (chunk) => {
      uploaded += chunk.length;
      const percent = Math.min(100, Math.floor((uploaded / totalSize) * 100));
      progressMap.set(uploadId, percent);
    });

    // Pipe file stream directly to Backblaze
    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: uploadAuthToken,
        "X-Bz-File-Name": encodeURIComponent(req.file.originalname),
        "Content-Type": req.file.mimetype || "b2/x-auto",
        "X-Bz-Content-Sha1": "do_not_verify",
      },
      body: fileStream,
    });

    if (!uploadRes.ok) {
      throw new Error(`B2 upload failed: ${uploadRes.status} ${await uploadRes.text()}`);
    }

    const uploadResult = await uploadRes.json();

    fs.unlink(req.file.path, () => {});
    progressMap.set(uploadId, 100); // mark complete

    const fileUrl = `${downloadUrl}/file/${B2_BUCKET_NAME}/${encodeURIComponent(
      uploadResult.fileName
    )}`;

    res.json({ success: true, uploadId, fileUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
