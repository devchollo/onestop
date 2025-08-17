const fetch = require('node-fetch');

async function b2AuthorizeAccount() {
  const { B2_KEY_ID, B2_APP_KEY } = process.env;
  if (!B2_KEY_ID || !B2_APP_KEY) throw new Error('B2_KEY_ID or B2_APP_KEY not set');

  const credentials = Buffer.from(`${B2_KEY_ID}:${B2_APP_KEY}`).toString('base64');

  const res = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
    headers: { Authorization: `Basic ${credentials}` },
  });
  if (!res.ok) throw new Error('B2 authorize failed: ' + (await res.text()));

  return res.json();
}

async function b2GetUploadUrl(apiUrl, authorizationToken, bucketId) {
  const res = await fetch(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
    method: 'POST',
    headers: { Authorization: authorizationToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucketId }),
  });
  if (!res.ok) throw new Error('B2 get upload URL failed: ' + (await res.text()));
  return res.json();
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed, use GET' });
    return;
  }

  try {
    const { B2_BUCKET_ID } = process.env;
    if (!B2_BUCKET_ID) throw new Error('B2_BUCKET_ID not set');

    const { apiUrl, authorizationToken, downloadUrl } = await b2AuthorizeAccount();

    const uploadData = await b2GetUploadUrl(apiUrl, authorizationToken, B2_BUCKET_ID);

    // Return uploadUrl, authorizationToken, and also downloadUrl for public URL building on client
    res.status(200).json({
      uploadUrl: uploadData.uploadUrl,
      authorizationToken: uploadData.authorizationToken,
      downloadUrl,
      bucketId: B2_BUCKET_ID,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};