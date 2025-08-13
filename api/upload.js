export const config = {
  api: {
    bodyParser: false, // so we can stream file uploads
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY; // PRIVATE key
    const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET;

    // Get query params for file info
    const { fileName, fileType } = req.query;
    if (!fileName || !fileType) {
      return res.status(400).json({ error: 'Missing fileName or fileType' });
    }

    const filePath = `${Date.now()}-${fileName.replace(/[^a-z0-9.]/gi, "_")}`;
    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(SUPABASE_BUCKET)}/${encodeURIComponent(filePath)}`;

    // Stream the incoming file to Supabase
    const upstream = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': fileType,
        'x-upsert': 'true'
      },
      body: req
    });

    if (!upstream.ok) {
      const errorText = await upstream.text();
      throw new Error(errorText);
    }

    res.status(200).json({
      publicUrl: `${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(SUPABASE_BUCKET)}/${encodeURIComponent(filePath)}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
