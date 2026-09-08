'use strict';

// Cliente REST de Polar sobre undici. Patron de resiliencia como
// telemetria-tts/transport.js: timeout con AbortSignal, reintentos ante
// red/timeout (no ante 4xx).
//
// TODO(agente-03): completar los metodos que haga falta (crear producto no,
// eso se hace desde el dashboard; si checkout + leer suscripcion para el job
// de reconciliacion).

const { fetch } = require('undici');
const config = require('../config');

const BASE = 'https://api.polar.sh/v1';

async function polarFetch(path, { method = 'GET', body, retries = 2 } = {}) {
  const url = `${BASE}${path}`;
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${config.polarApiKey}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(8000),
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  let lastErr;
  for (let intento = 0; intento <= retries; intento++) {
    try {
      const res = await fetch(url, opts);
      const text = await res.text();
      const json = text ? JSON.parse(text) : null;
      if (res.ok) return json;
      // 4xx: error del request, no reintentar.
      if (res.status >= 400 && res.status < 500) {
        const e = new Error(`Polar ${res.status}: ${text}`);
        e.status = res.status;
        e.polar = json;
        throw e;
      }
      lastErr = new Error(`Polar ${res.status}: ${text}`);
    } catch (err) {
      if (err.status && err.status < 500) throw err;
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, [500, 2000][intento] || 2000));
  }
  throw lastErr;
}

module.exports = { polarFetch, BASE };
