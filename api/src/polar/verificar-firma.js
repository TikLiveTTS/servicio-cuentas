'use strict';

// Verificacion de webhooks de Polar con standardwebhooks.
//
// Polar entrega el secret en dos formatos segun version:
//  - 'whsec_<base64>'  -> formato estandar, se pasa tal cual a new Webhook()
//  - 'polar_whs_<...>'  -> hay que base64-encodear el string ENTERO antes
//    (quirk documentado por Polar para ese formato)
// Requiere el body RAW (Buffer/string), no el JSON ya parseado.

const { Webhook } = require('standardwebhooks');
const config = require('../config');

let wh = null;
function getWebhook() {
  const secret = config.polarWebhookSecret;
  if (!secret) {
    const e = new Error('POLAR_WEBHOOK_SECRET no configurado');
    e.code = 'polar_no_configurado';
    throw e;
  }
  if (!wh) {
    const s = secret.trim();
    const arg = s.startsWith('polar_whs_')
      ? Buffer.from(s, 'utf-8').toString('base64')
      : s; // 'whsec_...' o base64 crudo
    wh = new Webhook(arg);
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
