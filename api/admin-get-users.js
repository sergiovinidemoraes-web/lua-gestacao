import crypto from 'crypto';

function verifyAdminToken(token) {
  const secret = process.env.ADMIN_SENHA;
  if (!token || !secret) return false;
  try {
    const dotIdx = token.indexOf('.');
    if (dotIdx === -1) return false;
    const expStr = token.slice(0, dotIdx);
    const sig = token.slice(dotIdx + 1);
    const exp = parseInt(expStr);
    if (isNaN(exp) || Date.now() > exp) return false;
    const expected = crypto.createHmac('sha256', secret).update(expStr).digest('hex');
    if (sig.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch(e) { return false; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://luamaterna.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { token } = req.body;
  if (!verifyAdminToken(token)) return res.status(403).json({ error: 'Sessão inválida ou expirada' });

  const SUPABASE_URL = 'https://mmjrcusivcjiqjelyjyu.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE_KEY) return res.status(500).json({ error: 'Serviço não configurado' });

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?select=id,nome,email,tipo,criado_em,whatsapp,cidade,verificada&order=criado_em.desc`, {
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.message || 'Erro ao buscar usuários' });
    return res.status(200).json({ users: data });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
