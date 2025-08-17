export default async function handler(req, res) {
  try {
    // Extract env variables
    const { B2_KEY_ID, B2_APP_KEY, B2_BUCKET_ID, B2_BUCKET_NAME } = process.env;

    // Basic verification of env variables
    if (!B2_KEY_ID || !B2_APP_KEY || !B2_BUCKET_ID || !B2_BUCKET_NAME) {
      return res.status(500).json({
        error: "Missing one or more required environment variables",
        details: {
          B2_KEY_ID: !!B2_KEY_ID,
          B2_APP_KEY: !!B2_APP_KEY,
          B2_BUCKET_ID: !!B2_BUCKET_ID,
          B2_BUCKET_NAME: !!B2_BUCKET_NAME,
        },
      });
    }

    console.log("🔑 Env variables verified");

    // 1. Authorize account
    const basicAuth = Buffer.from(`${B2_KEY_ID}:${B2_APP_KEY}`).toString("base64");

    const authRes = await fetch(
      "https://api.backblazeb2.com/b2api/v2/b2_authorize_account",
      {
        headers: {
          Authorization: "Basic " + basicAuth,
        },
      }
    );

    if (!authRes.ok) {
      const errorText = await authRes.text();
      throw new Error(`b2_authorize_account failed with status ${authRes.status}: ${errorText}`);
    }

    const authData = await authRes.json();

    console.log("✅ Authorized account:", {
      accountId: authData.accountId,
      apiUrl: authData.apiUrl,
      downloadUrl: authData.downloadUrl,
      tokenPreview: authData.authorizationToken?.slice(0, 15) + "...",
    });

    // Verify apiUrl does not end with slash to avoid double slash
    const apiUrl = authData.apiUrl.endsWith("/")
      ? authData.apiUrl.slice(0, -1)
      : authData.apiUrl;

    // 2. Get upload URL
    console.log("➡️ Requesting upload URL for bucket:", B2_BUCKET_ID);

    const uploadRes = await fetch(`${apiUrl}/b2_get_upload_url`, {
      method: "POST",
      headers: {
        Authorization: authData.authorizationToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ bucketId: B2_BUCKET_ID }),
    });

    if (!uploadRes.ok) {
      const errorText = await uploadRes.text();
      throw new Error(`b2_get_upload_url failed with status ${uploadRes.status}: ${errorText}`);
    }

    const uploadData = await uploadRes.json();

    console.log("✅ Received upload URL");

    // 3. Send back all relevant data
    return res.status(200).json({
      uploadUrl: uploadData.uploadUrl,
      authorizationToken: uploadData.authorizationToken,
      downloadUrl: authData.downloadUrl,
      bucketName: B2_BUCKET_NAME,
    });
  } catch (err) {
    console.error("❌ B2 API Error:", err);
    return res.status(500).json({
      error: "Failed to get B2 upload URL",
      details: err.message || err,
    });
  }
}