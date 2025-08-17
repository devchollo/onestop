import formidable from 'formidable';
import { Readable } from 'stream';

export const config = {
  api: {
    bodyParser: false, // Disable built-in bodyParser to use formidable
  },
};

// Replace with your environment variable names
const {
  B2_KEY_ID,
  B2_APP_KEY,
  B2_BUCKET_ID,
} = process.env;

async function b2AuthorizeAccount() {
  const credentials = Buffer.from(`${B2_KEY_ID}:${B2_APP_KEY}`).toString('base64');
  const res = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
    headers: {
      Authorization: `Basic ${credentials}`,
    },
  });
  if (!res.ok) {
    throw new Error(`b2_authorize_account failed: ${await res.text()}`);
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
    body: JSON.stringify({
      bucketId: B2_BUCKET_ID,
    }),
  });

  if (!res.ok) {
    throw new Error(`b2_get_upload_url failed: ${await res.text()}`);
  }
  return res.json();
}

async function uploadFileToB2(uploadUrl, uploadAuthToken, fileBuffer, fileName, contentType) {
  // Required headers specified by Backblaze B2:
  // https://www.backblaze.com/b2/docs/b2_upload_file.html

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
    throw new Error(`Upload failed: ${await res.text()}`);
  }
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed, use POST' });
  }

  try {
    // Parse the incoming 'multipart/form-data' request with formidable
    const form = formidable({ multiples: false });
    const parsed = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const file = parsed.files.file; // Assumes file input field named "file"
    if (!file) {
      return res.status(400).json({ error: 'File is required' });
    }

    // Read file buffer
    const fs = require('fs');
    const fileBuffer = await fs.promises.readFile(file.filepath);

    // 1. Authorize account
    const authData = await b2AuthorizeAccount();
    const { apiUrl, authorizationToken } = authData;

    // 2. Get upload URL
    const uploadData = await b2GetUploadUrl(apiUrl, authorizationToken);
    const { uploadUrl, authorizationToken: uploadAuthToken } = uploadData;

    // 3. Upload file to B2
    const uploadResult = await uploadFileToB2(
      uploadUrl,
      uploadAuthToken,
      fileBuffer,
      file.originalFilename,
      file.mimetype
    );

    // 4. Return upload result
    res.status(200).json({ success: true, uploadResult });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
}