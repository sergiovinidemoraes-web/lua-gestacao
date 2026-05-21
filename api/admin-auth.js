import crypto from 'crypto';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://luamaterna.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { senha } = req.body;
  const ADMIN_SENHA = process.env.ADMIN_SENHA;

  if (!ADMIN_SENHA) return res.status(500).json({ error: 'Servidor não configurado' });
  if (!senha || senha !== ADMIN_SENHA) {
    // Delay para dificultar brute-force
    await new Promise(r => setTimeout(r, 500));
    return res.status(401).json({ error: 'Senha incorreta' });
  }

  const exp = Date.now() + 2 * 60 * 60 * 1000; // 2 horas
  const expStr = String(exp);
  const sig = crypto.createHmac('sha256', ADMIN_SENHA).update(expStr).digest('hex');
  return res.status(200).json({ token: `${expStr}.${sig}` });
}
