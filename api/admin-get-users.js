export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://luamaterna.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { adminSenha } = req.body;
  const SUPABASE_URL = 'https://mmjrcusivcjiqjelyjyu.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SERVICE_KEY) return res.status(500).json({ error: 'Serviço não configurado' });

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
    const r = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?select=*&order=criado_em.desc`, {
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.message || 'Erro ao buscar usuários' });
    return res.status(200).json({ users: data });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
