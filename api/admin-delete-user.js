export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://luamaterna.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, adminSenha } = req.body;
  const SUPABASE_URL = 'https://mmjrcusivcjiqjelyjyu.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SERVICE_KEY) return res.status(500).json({ error: 'Serviço não configurado' });
  if (!userId) return res.status(400).json({ error: 'userId obrigatório' });

  try {
    const cfgRes = await fetch(`${SUPABASE_URL}/rest/v1/configuracoes?chave=eq.admin_senha&select=valor`, {
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
    });
    const cfgData = await cfgRes.json();
    if (!cfgData[0] || cfgData[0].valor !== adminSenha) {
      return res.status(403).json({ error: 'Senha incorreta' });
    }
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao verificar senha' });
  }

  try {
    const delRes = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?id=eq.${userId}`, {
      method: 'DELETE',
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
    });
    if (!delRes.ok) {
      const err = await delRes.json().catch(() => ({}));
      return res.status(delRes.status).json({ error: err.message || 'Erro ao remover' });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
