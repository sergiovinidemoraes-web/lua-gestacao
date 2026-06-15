import webpush from 'web-push';

const SUPABASE_URL = 'https://mmjrcusivcjiqjelyjyu.supabase.co';

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { targetUserId, title, body, url, jwt } = req.body || {};
  if (!targetUserId || !title || !jwt) {
    return res.status(400).json({ error: 'Parâmetros inválidos' });
  }

  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
  const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
  const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:contato@luamaterna.com';

  if (!SERVICE_KEY || !VAPID_PUBLIC || !VAPID_PRIVATE) {
    return res.status(500).json({ error: 'Serviço não configurado' });
  }

  // Valida JWT do chamador via Supabase
  try {
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${jwt}`, 'apikey': SERVICE_KEY }
    });
    if (!authRes.ok) return res.status(401).json({ error: 'Token inválido' });
  } catch (e) {
    return res.status(401).json({ error: 'Falha na autenticação' });
  }

  // Busca subscription do destinatário
  let subscription, subId;
  try {
    const subRes = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${encodeURIComponent(targetUserId)}&select=id,subscription&limit=1`,
      { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
    );
    const subData = await subRes.json();
    if (!subData || !subData.length) {
      return res.status(200).json({ sent: false, reason: 'no_subscription' });
    }
    subscription = subData[0].subscription;
    subId = subData[0].id;
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao buscar subscription' });
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  try {
    await webpush.sendNotification(subscription, JSON.stringify({
      title,
      body: body || '',
      url: url || '/',
      tag: 'lua-' + Date.now()
    }));
    return res.status(200).json({ sent: true });
  } catch (err) {
    // Subscription expirada ou inválida — remove do banco
    if (err.statusCode === 404 || err.statusCode === 410) {
      await fetch(
        `${SUPABASE_URL}/rest/v1/push_subscriptions?id=eq.${subId}`,
        { method: 'DELETE', headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
      ).catch(() => {});
      return res.status(200).json({ sent: false, reason: 'subscription_expired' });
    }
    console.error('[send-push]', err.message);
    return res.status(500).json({ error: 'Falha ao enviar notificação' });
  }
}
