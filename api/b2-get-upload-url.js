import fetch from "node-fetch";

export default async function handler(req, res) {
  try {
    const { B2_KEY_ID, B2_APP_KEY, B2_BUCKET_ID, B2_BUCKET_NAME } = process.env;

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

    // Step 1: Authorize Account
    const basicAuth = Buffer.from(`${B2_KEY_ID}:${B2_APP_KEY}`).toString("base64");
    const authRes = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
      headers: {
        Authorization: `Basic ${basicAuth}`,
      },
    });

    if (!authRes.ok) {
      const errText = await authRes.text();
      throw new Error(`b2_authorize_account failed with status ${authRes.status}: ${errText}`);
    }

    const authData = await authRes.json();

    console.log("✅ Authorized account:", {
      accountId: authData.accountId,
      apiUrl: authData.apiUrl,
      downloadUrl: authData.downloadUrl,
      tokenPreview: authData.authorizationToken?.slice(0, 15) + "...",
    });

    const apiUrl = authData.apiUrl.endsWith("/") ? authData.apiUrl.slice(0, -1) : authData.apiUrl;

    // Step 2: List Buckets to verify access (handle 401 gracefully)
    let accessibleBuckets = [];
    try {
      const listBucketsRes = await fetch(`${apiUrl}/b2api/v2/b2_list_buckets`, {
        method: "POST",
        headers: {
          Authorization: authData.authorizationToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ accountId: authData.accountId }),
      });

      if (!listBucketsRes.ok) {
        const errText = await listBucketsRes.text();
        throw new Error(`b2_list_buckets failed with status ${listBucketsRes.status}: ${errText}`);
      }

      const listBucketsData = await listBucketsRes.json();
      accessibleBuckets = listBucketsData.buckets;

      console.log("Buckets accessible to key:", accessibleBuckets);
    } catch (bucketErr) {
      if (bucketErr.message.includes("b2_list_buckets failed with status 401")) {
        console.warn("⚠️ Insufficient permissions to list buckets for this application key.");
      } else {
        throw bucketErr;
      }
    }

    // Step 3: Check if configured bucket ID is accessible, if buckets were listed
    if (accessibleBuckets.length > 0) {
      const foundBucket = accessibleBuckets.find((b) => b.bucketId === B2_BUCKET_ID);
      if (!foundBucket) {
        return res.status(400).json({
          error: `Bucket ID "${B2_BUCKET_ID}" not accessible by the provided application key.`,
          availableBuckets: accessibleBuckets.map(({ bucketId, bucketName }) => ({ bucketId, bucketName })),
        });
      }
      console.log(`Bucket "${foundBucket.bucketName}" found, proceeding.`);
    } else {
      console.log("Skipping bucket access verification due to permissions.");
    }

    // Step 4: Request Upload URL
    const uploadUrlRes = await fetch(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
      method: "POST",
      headers: {
        Authorization: authData.authorizationToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ bucketId: B2_BUCKET_ID }),
    });

    if (!uploadUrlRes.ok) {
      const errText = await uploadUrlRes.text();
      throw new Error(`b2_get_upload_url failed with status ${uploadUrlRes.status}: ${errText}`);
    }

    const uploadUrlData = await uploadUrlRes.json();

    console.log("✅ Received upload URL");

    // Response with upload info
    return res.status(200).json({
      uploadUrl: uploadUrlData.uploadUrl,
      authorizationToken: uploadUrlData.authorizationToken,
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