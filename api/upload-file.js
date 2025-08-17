import formidable from 'formidable';
import fs from 'fs/promises';

export const config = {
  api: {
    bodyParser: false, // disable built-in bodyParser as formidable handles the parsing
  },
};

// Validate required env vars once
const {
  B2_KEY_ID,
  B2_APP_KEY,
  B2_BUCKET_ID,
} = process.env;

if (!B2_KEY_ID || !B2_APP_KEY || !B2_BUCKET_ID) {
  throw new Error('Missing required Backblaze B2 environment variables.');
}

async function b2AuthorizeAccount() {
  const credentials = Buffer.from(`${B2_KEY_ID}:${B2_APP_KEY}`).toString('base64');
  const res = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
    headers: { Authorization: `Basic ${credentials}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`b2_authorize_account failed: ${text}`);
  }
  return res.json();
}

async function b2GetUploadUrl(apiUrl, authorizationToken) {
  const res = await fetch(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
    method: 'POST',
    headers: {
      Authorization: authorizationToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ bucketId: B2_BUCKET_ID }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`b2_get_upload_url failed: ${text}`);
  }
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
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed: ${text}`);
  }
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed, use POST' });
  }

  try {
    const form = formidable({ multiples: false });
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const file = files.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Log for debugging
    console.log('Uploaded file object:', file);

    let fileBuffer;

    if (typeof file.toBuffer === 'function') {
      // Use formidable v2+ toBuffer method if available
      fileBuffer = await file.toBuffer();
    } else {
      const filePath = file.filepath || file.path;
      if (!filePath) {
        return res.status(400).json({ error: 'Uploaded file path is missing' });
      }
      fileBuffer = await fs.readFile(filePath);
    }

    const { apiUrl, authorizationToken } = await b2AuthorizeAccount();
    const { uploadUrl, authorizationToken: uploadAuthToken } = await b2GetUploadUrl(apiUrl, authorizationToken);

    const uploadResult = await uploadFileToB2(
      uploadUrl,
      uploadAuthToken,
      fileBuffer,
      file.originalFilename || file.name || 'upload-' + Date.now(),
      file.mimetype || 'application/octet-stream'
    );

    return res.status(200).json({ success: true, uploadResult });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}