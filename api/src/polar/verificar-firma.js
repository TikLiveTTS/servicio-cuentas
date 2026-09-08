'use strict';

// Verificacion de webhooks de Polar con la libreria standardwebhooks.
// IMPORTANTE (01-hallazgos.md seccion 2): el secreto que da Polar (polar_whs_...)
// hay que base64-encodearlo ENTERO antes de pasarlo a new Webhook().
// Requiere el body RAW (Buffer/string), no el JSON ya parseado.

const { Webhook } = require('standardwebhooks');
const config = require('../config');

let wh = null;
function getWebhook() {
  if (!config.polarWebhookSecret) {
    const e = new Error('POLAR_WEBHOOK_SECRET no configurado');
    e.code = 'polar_no_configurado';
    throw e;
  }
  if (!wh) {
    const secretB64 = Buffer.from(config.polarWebhookSecret.trim(), 'utf-8').toString('base64');
    wh = new Webhook(secretB64);
  }
  return wh;
}

// Devuelve el payload verificado (objeto) o lanza si la firma no valida.
function verificarFirma(rawBody, headers) {
  const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf-8') : String(rawBody);
  const hdrs = {};
  for (const [k, v] of Object.entries(headers || {})) {
    hdrs[k] = Array.isArray(v) ? v[0] : v;
  }
  return getWebhook().verify(body, hdrs);
}

module.exports = { verificarFirma };
