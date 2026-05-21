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

  const { userId, token } = req.body;
  if (!verifyAdminToken(token)) return res.status(403).json({ error: 'Sessão inválida ou expirada' });
  if (!userId) return res.status(400).json({ error: 'userId obrigatório' });

  const SUPABASE_URL = 'https://mmjrcusivcjiqjelyjyu.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE_KEY) return res.status(500).json({ error: 'Serviço não configurado' });

  try {
    await fetch(`${SUPABASE_URL}/rest/v1/usuarios?id=eq.${userId}`, {
      method: 'DELETE',
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
    });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }

  try {
    const swapRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `deleted_${Date.now()}_${userId.slice(0,8)}@removed.invalid`, email_confirm: true })
    });
    if (!swapRes.ok) {
      const swapErr = await swapRes.json().catch(() => ({}));
      console.warn('email swap falhou:', swapErr.message);
    }
  } catch(e) {
    console.warn('email swap erro:', e.message);
  }

  try {
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
    });
    if (!authRes.ok) {
      const err = await authRes.json().catch(() => ({}));
      return res.status(authRes.status).json({ error: err.message || 'Erro ao remover do Auth' });
    }
    return res.status(200).json({ ok: true });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
