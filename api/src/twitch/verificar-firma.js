'use strict';

const crypto = require('crypto');
const config = require('../config');

// Verifica la firma HMAC-SHA256 de un webhook de EventSub. El mensaje
// firmado es Message-Id + Message-Timestamp + body crudo, concatenados en
// ese orden exacto (confirmado contra la documentacion oficial de Twitch).
// El header trae el prefijo "sha256=" segun la documentacion -- se tolera
// que no lo traiga tambien, por las dudas, comparando solo el hex.
function verificarFirmaTwitch({ messageId, timestamp, rawBody, signature }) {
  if (!config.twitchWebhookSecret) {
    const e = new Error('TWITCH_WEBHOOK_SECRET no configurado');
    e.code = 'twitch_webhook_no_configurado';
    throw e;
  }

  const hmac = crypto
    .createHmac('sha256', config.twitchWebhookSecret)
    .update(messageId + timestamp + rawBody)
    .digest('hex');

  const recibido = String(signature || '').replace(/^sha256=/, '');
  const a = Buffer.from(hmac);
  const b = Buffer.from(recibido);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { verificarFirmaTwitch };
