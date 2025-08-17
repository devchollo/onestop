export default async function handler(req, res) {
  try {
    const { B2_KEY_ID, B2_APP_KEY, B2_BUCKET_ID, B2_BUCKET_NAME } = process.env;

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

    const authData = await authRes.json();
    if (!authRes.ok) throw new Error(JSON.stringify(authData));

//debugger here

  console.log("Using bucketId:", B2_BUCKET_ID);
console.log("AuthData:", {
  apiUrl: authData.apiUrl,
  accountId: authData.accountId,
  token: authData.authorizationToken?.slice(0, 15) + "...",
});

    // 2. Get upload URL
    const uploadRes = await fetch(
      `${authData.apiUrl}/b2api/v2/b2_get_upload_url`,
      {
        method: "POST",
        headers: {
          Authorization: authData.authorizationToken, // <- must be exact
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bucketId: B2_BUCKET_ID }), // <- must match your bucket
      }
    );

    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) throw new Error(JSON.stringify(uploadData));

    res.status(200).json({
      uploadUrl: uploadData.uploadUrl,
      authorizationToken: uploadData.authorizationToken,
      downloadUrl: authData.downloadUrl,
      bucketName: B2_BUCKET_NAME,
    });
  } catch (err) {
    console.error("B2 API Error:", err);
    res.status(500).json({
      error: "Failed to get B2 upload URL",
      details: err.message || err,
    });
  }
}