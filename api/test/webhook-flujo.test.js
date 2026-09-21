'use strict';

// Flujo completo del webhook con payload firmado valido: verifica firma ->
// dedup -> resuelve user y plan por product_id -> upsert. Sin red ni DB: se
// stubbean las queries.

const { test } = require('node:test');
const assert = require('node:assert');

process.env.POSTGRES_URL = process.env.POSTGRES_URL || 'postgresql://u:p@localhost:5432/x';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'x'.repeat(32);
const SECRET = 'polar_whs_testsecret';
process.env.POLAR_WEBHOOK_SECRET = SECRET;
process.env.POLAR_PRODUCT_ID_SIN_PROMOS = 'prod-sin-promos';

const upserts = [];
const vistos = new Set();
function stub(mod, exp) {
  const p = require.resolve(mod);
  require.cache[p] = { id: p, filename: p, loaded: true, exports: exp };
}
stub('../src/queries/marcar-evento-webhook', {
  marcarEventoWebhook: async (id) => (vistos.has(id) ? false : (vistos.add(id), true)),
});
stub('../src/queries/upsert-suscripcion', { upsertSuscripcion: async (a) => { upserts.push(a); return {}; } });
stub('../src/queries/buscar-usuario-por-email', { buscarUsuarioPorEmail: async () => null });

const express = require('express');
const { Webhook } = require('standardwebhooks');
const router = require('../src/routes/webhook-polar');

const wh = new Webhook(Buffer.from(SECRET, 'utf-8').toString('base64'));
async function enviar(id, evento) {
  const app = express();
  app.use('/api', router);
  const server = app.listen(0);
  try {
    const body = JSON.stringify(evento);
    const ts = new Date();
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/webhooks/polar`, {
      method: 'POST',
      headers: {
        'webhook-id': id,
        'webhook-timestamp': String(Math.floor(ts.getTime() / 1000)),
        'webhook-signature': wh.sign(id, ts, body),
      },
      body,
    });
    return res.json();
  } finally {
    server.close();
  }
}

test('webhook firmado: upsert con plan por product_id y dedup por webhook-id', async () => {
  const sub = (product_id) => ({
    type: 'subscription.active',
    data: { id: 's1', status: 'active', product_id, cancel_at_period_end: false,
      current_period_end: '2027-01-01T00:00:00Z', customer: { external_id: 'user-1' } },
  });
  assert.deepEqual(await enviar('m1', sub('prod-sin-promos')), { received: true });
  assert.deepEqual(await enviar('m2', sub('otro-prod')), { received: true });
  assert.deepEqual(await enviar('m2', sub('otro-prod')), { received: true, duplicate: true });
  assert.equal(upserts.length, 2);
  assert.equal(upserts[0].userId, 'user-1');
  assert.equal(upserts[0].planId, 'sin-promos');
  assert.equal(upserts[1].planId, 'pro');
});
