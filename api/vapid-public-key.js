function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && (
    origin === 'https://luamaterna.com' ||
    origin === 'https://www.luamaterna.com' ||
    /^https:\/\/.*\.vercel\.app$/.test(origin) ||
    /^http:\/\/localhost(:\d+)?$/.test(origin) ||
    /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)
  )) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://luamaterna.com');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return res.status(500).json({ error: 'VAPID não configurado' });

  res.setHeader('Cache-Control', 'public, max-age=86400');
  return res.status(200).json({ publicKey: key });
}
