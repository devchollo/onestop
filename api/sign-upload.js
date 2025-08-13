export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { fileName } = req.body;
  if (!fileName) return res.status(400).json({ error: 'Missing fileName' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
  const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET;

  const filePath = `${Date.now()}-${fileName.replace(/[^a-z0-9.]/gi, "_")}`;
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${filePath}`;

  res.status(200).json({ uploadUrl, publicUrl: `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${filePath}` });
}
