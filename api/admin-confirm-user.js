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

  const { email, token } = req.body;
  if (!verifyAdminToken(token)) return res.status(403).json({ error: 'Sessão inválida ou expirada' });
  if (!email) return res.status(400).json({ error: 'email obrigatório' });

  const SUPABASE_URL = 'https://mmjrcusivcjiqjelyjyu.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE_KEY) return res.status(500).json({ error: 'Serviço não configurado' });

  try {
    const uRes = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&select=id`, {
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
    });
    const uData = await uRes.json();
    if (!uData || !uData.length) {
      return res.status(404).json({ error: 'Usuário não encontrado. Pode ainda não ter concluído o cadastro.' });
    }
    const userId = uData[0].id;

    const confirmRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_confirm: true })
    });
    if (!confirmRes.ok) {
      const err = await confirmRes.json().catch(() => ({}));
      return res.status(confirmRes.status).json({ error: err.message || 'Erro ao confirmar email' });
    }
    return res.status(200).json({ ok: true });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
