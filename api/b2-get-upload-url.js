export default async function handler(req, res) {
  try {

    console.log("ENV CHECK:", {
  keyId: process.env.B2_KEY_ID,
  appKeySet: !!process.env.B2_APP_KEY,
  bucketId: process.env.B2_BUCKET_ID,
});

    const { B2_KEY_ID, B2_APP_KEY, B2_BUCKET_ID, B2_BUCKET_NAME } = process.env;

    // 🚨 sanity check before even calling Backblaze
    const expectedBucketId = "e76bb8adf2d8b6649480061f"; // from your screenshot
    if (B2_BUCKET_ID?.trim() !== expectedBucketId) {
      throw new Error(
        `Bucket ID mismatch. Env has "${B2_BUCKET_ID}", expected "${expectedBucketId}".`
      );
    }

    // 1. Authorize account
    const authRes = await fetch(
      "https://api.backblazeb2.com/b2api/v2/b2_authorize_account",
      {
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(`${B2_KEY_ID}:${B2_APP_KEY}`).toString("base64"),
        },
      }
    );

    const authText = await authRes.text();
    let authData;
    try {
      authData = JSON.parse(authText);
    } catch {
      throw new Error("Auth response not JSON: " + authText);
    }

    if (!authRes.ok) {
      throw new Error("Auth failed: " + JSON.stringify(authData));
    }

    console.log("✅ AuthData:", {
      apiUrl: authData.apiUrl,
      accountId: authData.accountId,
      token: authData.authorizationToken?.slice(0, 15) + "...",
    });

    // 2. Get upload URL
    console.log("➡️ Calling b2_get_upload_url with bucket:", B2_BUCKET_ID);

    const uploadRes = await fetch(
      `${authData.apiUrl}/b2api/v2/b2_get_upload_url`,
      {
        method: "POST",
        headers: {
          Authorization: authData.authorizationToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bucketId: B2_BUCKET_ID }),
      }
    );

    const uploadText = await uploadRes.text();
    let uploadData;
    try {
      uploadData = JSON.parse(uploadText);
    } catch {
      throw new Error("Upload response not JSON: " + uploadText);
    }

    if (!uploadRes.ok) {
      throw new Error("Upload failed: " + JSON.stringify(uploadData));
    }

    res.status(200).json({
      uploadUrl: uploadData.uploadUrl,
      authorizationToken: uploadData.authorizationToken,
      downloadUrl: authData.downloadUrl,
      bucketName: B2_BUCKET_NAME,
    });
  } catch (err) {
    console.error("❌ B2 API Error:", err);
    res.status(500).json({
      error: "Failed to get B2 upload URL",
      details: err.message || err,
    });
  }
}
