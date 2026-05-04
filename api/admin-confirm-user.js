export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://luamaterna.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, adminSenha } = req.body;
  const SUPABASE_URL = 'https://mmjrcusivcjiqjelyjyu.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SERVICE_KEY) return res.status(500).json({ error: 'Serviço não configurado' });
  if (!email) return res.status(400).json({ error: 'email obrigatório' });

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

  // Busca o id do usuário pelo email na tabela usuarios
  try {
    const uRes = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&select=id`, {
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
    });
    const uData = await uRes.json();
    if (!uData || !uData.length) {
      return res.status(404).json({ error: 'Usuário não encontrado. Pode ainda não ter concluído o cadastro.' });
    }
    const userId = uData[0].id;

    // Confirma o email diretamente via Admin API
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
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
