'use strict';

const config = require('../config');

// Como cada usuario vincula su propia cuenta de Twitch (no hay una cuenta
// de "bot" aparte), el mensaje se manda siempre como el usuario mismo, en
// su propio canal -- sender_id = broadcaster_id.
async function enviarMensajeTwitch({ accessToken, broadcasterId, mensaje }) {
  const res = await fetch('https://api.twitch.tv/helix/chat/messages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Client-Id': config.twitchClientId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ broadcaster_id: broadcasterId, sender_id: broadcasterId, message: mensaje }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const e = new Error(`Twitch no acepto el mensaje: ${res.status} ${await res.text()}`);
    e.code = 'twitch_envio_fallido';
    throw e;
  }
  return res.json();
}

module.exports = { enviarMensajeTwitch };
