import multer from 'multer';
import fs from 'fs/promises';

export const config = {
  api: { bodyParser: false }, // disable default body parser so multer can handle it
};

// Multer setup: files saved to /tmp/
const upload = multer({ dest: '/tmp/' });

// Helper to run multer as middleware
function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// Backblaze B2 helper functions
async function b2AuthorizeAccount() {
  const { B2_KEY_ID, B2_APP_KEY } = process.env;
  if (!B2_KEY_ID || !B2_APP_KEY) throw new Error('B2_KEY_ID or B2_APP_KEY not set');

  const credentials = Buffer.from(`${B2_KEY_ID}:${B2_APP_KEY}`).toString('base64');
  const res = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
    headers: { Authorization: `Basic ${credentials}` },
  });
  if (!res.ok) throw new Error('B2 authorize failed');
  return res.json();
}

async function b2GetUploadUrl(apiUrl, authorizationToken, bucketId) {
  const res = await fetch(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
    method: 'POST',
    headers: { Authorization: authorizationToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucketId }),
  });
  if (!res.ok) throw new Error('B2 get upload URL failed');
  return res.json();
}

async function uploadFileToB2(uploadUrl, uploadAuthToken, fileBuffer, fileName, contentType) {
  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: uploadAuthToken,
      'X-Bz-File-Name': encodeURIComponent(fileName),
      'Content-Type': contentType || 'b2/x-auto',
      'X-Bz-Content-Sha1': 'do_not_verify',
    },
    body: fileBuffer,
  });
  if (!res.ok) throw new Error('B2 file upload failed');
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    await runMiddleware(req, res, upload.single('file'));

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const fileBuffer = await fs.readFile(req.file.path);
    await fs.unlink(req.file.path);

    const { B2_BUCKET_ID, B2_BUCKET_NAME } = process.env;
    if (!B2_BUCKET_ID || !B2_BUCKET_NAME) {
      return res.status(500).json({ error: 'B2_BUCKET_ID or B2_BUCKET_NAME not set' });
    }

    // Authorize
    const { apiUrl, authorizationToken, downloadUrl } = await b2AuthorizeAccount();

    // Get upload URL
    const { uploadUrl, authorizationToken: uploadAuthToken } = await b2GetUploadUrl(
      apiUrl,
      authorizationToken,
      B2_BUCKET_ID
    );

    // Upload file
    const uploadResult = await uploadFileToB2(
      uploadUrl,
      uploadAuthToken,
      fileBuffer,
      req.file.originalname,
      req.file.mimetype
    );

    // Build public file URL
    const fileUrl = `${downloadUrl}/file/${B2_BUCKET_NAME}/${encodeURIComponent(uploadResult.fileName)}`;

    return res.status(200).json({ success: true, uploadResult, fileUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
