import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

const app = express();
const PORT = process.env.PORT || 3000;

import cors from "cors";

// Allow your Vercel frontend domain
const allowedOrigins = [
  "https://onestop-kent-johndear-sevillejos-projects.vercel.app",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
  })
);

// Multer stores files temporarily in /tmp
const upload = multer({ dest: "/tmp" });

// In-memory map to store progress
const progressMap = {};

// --- Backblaze Helpers ---
async function b2AuthorizeAccount() {
  const { B2_KEY_ID, B2_APP_KEY } = process.env;
  if (!B2_KEY_ID || !B2_APP_KEY)
    throw new Error("B2_KEY_ID or B2_APP_KEY not set");

  const credentials = Buffer.from(`${B2_KEY_ID}:${B2_APP_KEY}`).toString(
    "base64"
  );
  const res = await fetch(
    "https://api.backblazeb2.com/b2api/v2/b2_authorize_account",
    {
      headers: { Authorization: `Basic ${credentials}` },
    }
  );
  if (!res.ok) throw new Error("B2 authorize failed");
  return res.json();
}

async function b2GetUploadUrl(apiUrl, authorizationToken, bucketId) {
  const res = await fetch(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
    method: "POST",
    headers: {
      Authorization: authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ bucketId }),
  });
  if (!res.ok) throw new Error("B2 get upload URL failed");
  return res.json();
}

// --- Upload Route ---
app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const { B2_BUCKET_ID, B2_BUCKET_NAME } = process.env;
  if (!B2_BUCKET_ID || !B2_BUCKET_NAME) {
    return res
      .status(500)
      .json({ error: "B2_BUCKET_ID or B2_BUCKET_NAME not set" });
  }

  const uploadId = uuidv4();
  progressMap[uploadId] = 0;

  try {
    // Authorize B2
    const { apiUrl, authorizationToken, downloadUrl } =
      await b2AuthorizeAccount();

    // Get upload URL
    const { uploadUrl, authorizationToken: uploadAuthToken } =
      await b2GetUploadUrl(apiUrl, authorizationToken, B2_BUCKET_ID);

    // Stream file to Backblaze with progress tracking
    const filePath = req.file.path;

    let uploaded = 0;

    const fileStream = fs.createReadStream(filePath);
    fileStream.on("data", (chunk) => {
      uploaded += chunk.length;
      progressMap[uploadId] = uploaded / fileSize;
    });
    const fileSize = fs.statSync(filePath).size;
    const fileBuffer = fs.readFileSync(filePath);
    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: uploadAuthToken,
        "X-Bz-File-Name": encodeURIComponent(req.file.originalname),
        "Content-Type": req.file.mimetype || "b2/x-auto",
        "X-Bz-Content-Sha1": "do_not_verify",
        "Content-Length": fileSize,
      },
      body: fileBuffer,
    });

    let uploadResult;
    try {
      uploadResult = await uploadRes.json();
    } catch (parseErr) {
      console.error("Failed to parse Backblaze response:", parseErr);
      return res.status(500).json({ error: "Invalid response from B2" });
    }

    if (!uploadRes.ok) {
      console.error("B2 upload error:", uploadResult);
      return res
        .status(uploadRes.status)
        .json({ error: "B2 file upload failed", details: uploadResult });
    }

    // Clean up tmp file
    fs.unlinkSync(filePath);

    // Build public file URL
    const fileUrl = `${downloadUrl}/file/${B2_BUCKET_NAME}/${encodeURIComponent(
      uploadResult.fileName
    )}`;

    // Mark progress as done
    progressMap[uploadId] = 1;

    return res.status(200).json({ success: true, uploadId, fileUrl });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ error: err.message || "Internal Server Error" });
  }
});

// --- Progress Route ---
app.get("/progress/:id", (req, res) => {
  const { id } = req.params;
  const progress = progressMap[id];
  if (progress === undefined) {
    return res.status(404).json({ error: "Invalid uploadId" });
  }
  res.json({ progress });
});

// --- Health Route (optional) ---
app.get("/", (req, res) => {
  res.send("✅ Upload service running.");
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
