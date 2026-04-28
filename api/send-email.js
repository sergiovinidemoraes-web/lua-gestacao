export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://luamaterna.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { to, nomeGestante, dppDisplay, contato, pdfBase64, filename } = req.body;
  const RESEND_KEY = process.env.RESEND_KEY;

  if (!RESEND_KEY) return res.status(500).json({ error: 'Serviço de e-mail não configurado' });
  if (!to || !pdfBase64) return res.status(400).json({ error: 'Dados incompletos' });

  var infoLinhas = '— Gestante: ' + nomeGestante;
  if (dppDisplay) infoLinhas += '<br>— DPP: ' + dppDisplay;
  if (contato) infoLinhas += '<br>— Contato: ' + contato;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + RESEND_KEY
      },
      body: JSON.stringify({
        from: 'Lua Gestação <noreply@luamaterna.com>',
        to: [to],
        subject: 'Plano de Parto — ' + nomeGestante,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#3c2319;">
            <div style="background:#c9897a;padding:28px 32px;border-radius:12px 12px 0 0;">
              <h2 style="color:#fff;margin:0;font-size:22px;">🌙 Plano de Parto</h2>
              <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:14px;">Lua Gestação</p>
            </div>
            <div style="background:#fcf6f3;padding:28px 32px;border-radius:0 0 12px 12px;border:1px solid #f0e4de;">
              <p style="margin:0 0 16px;">Olá! Segue em anexo o Plano de Parto gerado pelo app <strong>Lua Gestação</strong>.</p>
              <div style="background:#fff;border-left:3px solid #c9897a;padding:12px 16px;border-radius:4px;font-size:14px;line-height:1.8;">
                ${infoLinhas}
              </div>
              <p style="margin:20px 0 0;font-size:13px;color:#7a6455;">Com carinho 💛<br>Equipe Lua Gestação</p>
            </div>
          </div>
        `,
        attachments: [{ filename: filename || 'PlanoDePartoLua.pdf', content: pdfBase64 }]
      })
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.message || 'Erro ao enviar e-mail' });

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
