export default async function handler(req, res) {
  try {
    const { B2_KEY_ID, B2_APP_KEY, B2_BUCKET_ID, B2_BUCKET_NAME } = process.env;

    // Step 1: Authorize account
    const authRes = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
      headers: {
        Authorization: "Basic " + Buffer.from(`${B2_KEY_ID}:${B2_APP_KEY}`).toString("base64"),
      },
    });

    const authData = await authRes.json();
    if (!authRes.ok) {
      return res.status(authRes.status).json({ error: authData });
    }

    // Step 2: Get upload URL
    const uploadRes = await fetch(`${authData.apiUrl}/b2api/v2/b2_get_upload_url`, {
      method: "POST",
      headers: {
        Authorization: authData.authorizationToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ bucketId: B2_BUCKET_ID }),
    });

    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) {
      return res.status(uploadRes.status).json({ error: uploadData });
    }

    res.status(200).json({
      uploadUrl: uploadData.uploadUrl,
      authorizationToken: uploadData.authorizationToken,
      downloadUrl: authData.downloadUrl,
      bucketName: B2_BUCKET_NAME, // ✅ from env, not API
    });
  } catch (err) {
    console.error("B2 API error:", err);
    res.status(500).json({ error: "Failed to get B2 upload URL" });
  }
}
