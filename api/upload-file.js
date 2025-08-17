import nextConnect from 'next-connect';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';

// Multer setup: store to temp dir, in memory option can be used alternately
const upload = multer({ dest: '/tmp/' });

export const config = {
  api: {
    bodyParser: false, // required for multer to work
  },
};

// Your existing B2 helper functions (authorize, getUploadUrl, uploadFileToB2)
// Reuse these from your existing code or place here

async function b2AuthorizeAccount() {
  const { B2_KEY_ID, B2_APP_KEY } = process.env;
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

const handler = nextConnect();

// multer middleware to parse single file from 'file' field
handler.use(upload.single('file'));

handler.post(async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Read file buffer
    const fileBuffer = await fs.readFile(req.file.path);

    // Remove temp file after reading
    await fs.unlink(req.file.path);

    // Backblaze B2 env vars
    const { B2_BUCKET_ID } = process.env;
    if (!B2_BUCKET_ID) {
      return res.status(500).json({ error: 'B2_BUCKET_ID not set in environment' });
    }

    // B2 flow
    const { apiUrl, authorizationToken } = await b2AuthorizeAccount();
    const { uploadUrl, authorizationToken: uploadAuthToken } = await b2GetUploadUrl(apiUrl, authorizationToken, B2_BUCKET_ID);

    const uploadResult = await uploadFileToB2(
      uploadUrl,
      uploadAuthToken,
      fileBuffer,
      req.file.originalname,
      req.file.mimetype
    );

    return res.status(200).json({ success: true, uploadResult });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default handler;