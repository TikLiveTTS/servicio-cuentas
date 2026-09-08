'use strict';

// Webhook de Polar: firma invalida -> 403, sin tocar la DB.
// La DB no se toca porque verificarFirma lanza antes de cualquier query.

const { test } = require('node:test');
const assert = require('node:assert');

process.env.POSTGRES_URL = process.env.POSTGRES_URL || 'postgresql://u:p@localhost:5432/x';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'x'.repeat(32);
process.env.POLAR_WEBHOOK_SECRET = 'polar_whs_testsecret';

const express = require('express');
const webhookRouter = require('../src/routes/webhook-polar');

test('webhook con firma invalida -> 403 errors.invalidSignature', async () => {
  const app = express();
  app.use('/api', webhookRouter);
  const server = app.listen(0);
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/webhooks/polar`, {
      method: 'POST',
      headers: { 'webhook-id': 'x', 'webhook-timestamp': '1', 'webhook-signature': 'v1,bad' },
      body: JSON.stringify({ type: 'subscription.active', data: {} }),
    });
    assert.equal(res.status, 403);
    const b = await res.json();
    assert.equal(b.errorKey, 'errors.invalidSignature');
  } finally {
    server.close();
  }
});
