'use strict';

// Limite documentado por Kick: 500 caracteres (grapheme clusters) y maximo
// 2048 bytes UTF-8 -- Kick lo corta o rechaza, esto no lo valida antes.
async function enviarMensajeKick({ accessToken, broadcasterId, mensaje }) {
  const res = await fetch('https://api.kick.com/public/v1/chat', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content: mensaje, type: 'user', broadcaster_user_id: Number(broadcasterId) }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const e = new Error(`Kick no acepto el mensaje: ${res.status} ${await res.text()}`);
    e.code = 'kick_envio_fallido';
    throw e;
  }
  return res.json();
}

module.exports = { enviarMensajeKick };
