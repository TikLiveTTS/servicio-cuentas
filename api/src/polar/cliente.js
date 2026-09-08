'use strict';

// Cliente REST de Polar. fetch nativo (Node >=18). Patron de resiliencia como
// telemetria-tts/transport.js: timeout con AbortSignal, reintentos ante
// red/5xx (no ante 4xx).
//
// El OAT es un ORGANIZATION token: nunca se pasa organization_id en el body,
// Polar lo infiere del token.

const config = require('../config');

const BASE = config.polarEnv === 'production'
  ? 'https://api.polar.sh/v1'
  : 'https://sandbox-api.polar.sh/v1';

async function polarFetch(path, { method = 'GET', body, retries = 2 } = {}) {
  if (!config.polarApiKey) {
    const e = new Error('POLAR_API_KEY no configurado');
    e.code = 'polar_no_configurado';
    throw e;
  }
  const url = `${BASE}${path}`;
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${config.polarApiKey}`,
      'Content-Type': 'application/json',
    },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  let lastErr;
  for (let intento = 0; intento <= retries; intento++) {
    try {
      const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(8000) });
      const text = await res.text();
      const json = text ? JSON.parse(text) : null;
      if (res.ok) return json;
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
