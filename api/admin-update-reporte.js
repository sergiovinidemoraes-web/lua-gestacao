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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { token, id, markAll, lido, resposta } = req.body;
  if (!verifyAdminToken(token)) return res.status(403).json({ error: 'Sessão inválida ou expirada' });

  const SUPABASE_URL = 'https://mmjrcusivcjiqjelyjyu.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE_KEY) return res.status(500).json({ error: 'Serviço não configurado' });

  if (markAll) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/reportes?lido=eq.false`, {
        method: 'PATCH',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ lido: true })
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        return res.status(r.status).json({ error: err.message || 'Erro' });
      }
      return res.status(200).json({ ok: true });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (!id) return res.status(400).json({ error: 'id obrigatório' });

  const payload = {};
  if (lido !== undefined) payload.lido = lido;
  if (resposta !== undefined) payload.resposta = resposta;
  if (!Object.keys(payload).length) return res.status(400).json({ error: 'Nada a atualizar' });

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/reportes?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(payload)
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return res.status(r.status).json({ error: err.message || 'Erro ao atualizar reporte' });
    }
    return res.status(200).json({ ok: true });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
