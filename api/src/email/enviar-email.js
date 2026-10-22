'use strict';

const config = require('../config');

// Envio de emails via Resend (api.resend.com). Mismo patron que
// twitch/intercambiar-code.js: fetch nativo, sin SDK. Opcional para arrancar
// -- el llamador decide que hacer si credencialesCompletas() da false.
function credencialesCompletas() {
  return !!config.resendApiKey;
}

async function enviarEmail({ to, subject, html }) {
  if (!credencialesCompletas()) {
    const e = new Error('Envio de email no configurado (falta RESEND_API_KEY)');
    e.code = 'email_no_configurado';
    throw e;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: config.emailFrom, to, subject, html }),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error(`Resend respondio ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

module.exports = { enviarEmail, credencialesCompletas };
