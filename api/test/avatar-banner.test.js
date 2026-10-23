'use strict';

// POST /api/account/avatar|banner/firma y /confirmar. Sin red ni DB: se
// stubbea el modulo que habla con Cloudinary y la query que toca la fecha.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');

process.env.POSTGRES_URL = process.env.POSTGRES_URL || 'postgresql://u:p@localhost:5432/x';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'x'.repeat(32);

const llamadas = [];
let fallaFirma;

function stub(mod, exp) {
  const p = require.resolve(mod);
  require.cache[p] = { id: p, filename: p, loaded: true, exports: exp };
}

stub('../src/middleware/require-auth', { requireAuth: (req, res, next) => { req.userId = 'user-1'; next(); } });
stub('../src/middleware/rate-limit', { makeRateLimit: () => (req, res, next) => next() });
stub('../src/cloudinary/firmar-subida', {
  firmarSubida: (publicId) => {
    if (fallaFirma) throw fallaFirma;
    llamadas.push(`firmar:${publicId}`);
    return {
      signature: 'firma-falsa',
      timestamp: 1234,
      apiKey: 'key',
      cloudName: 'cloud',
      publicId,
      overwrite: true,
      allowedFormats: 'png,jpg,jpeg,webp',
    };
  },
});
stub('../src/queries/tocar-imagen-perfil', {
  tocarAvatar: async (userId) => { llamadas.push(`tocar-avatar:${userId}`); },
  tocarBanner: async (userId) => { llamadas.push(`tocar-banner:${userId}`); },
});
const SESION_FALSA = { user: { id: 'user-1', email: 'user-1@test.com', avatarUrl: 'https://cloudinary/avatares/user-1' }, plan: 'free', entitlements: [], subscription: null };
stub('../src/queries/estado-cuenta', {
  estadoCuenta: async (userId) => { llamadas.push(`estado-cuenta:${userId}`); return SESION_FALSA; },
});

const express = require('express');
const router = require('../src/routes/avatar-banner');

beforeEach(() => {
  llamadas.length = 0;
  fallaFirma = null;
});

async function post(path) {
  const app = express();
  app.use(express.json());
  app.use('/api', router);
  const server = app.listen(0);
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method: 'POST' });
    return { status: res.status, json: await res.json() };
  } finally {
    server.close();
  }
}

test('avatar/firma: devuelve la firma con el public_id del usuario', async () => {
  const res = await post('/api/account/avatar/firma');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.json.publicId, 'avatares/user-1');
  assert.deepStrictEqual(llamadas, ['firmar:avatares/user-1']);
});

test('banner/firma: devuelve la firma con el public_id del usuario', async () => {
  const res = await post('/api/account/banner/firma');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.json.publicId, 'banners/user-1');
  assert.deepStrictEqual(llamadas, ['firmar:banners/user-1']);
});

test('avatar/firma: Cloudinary no configurado -> 501', async () => {
  fallaFirma = Object.assign(new Error('sin credenciales'), { code: 'cloudinary_no_configurado' });
  const res = await post('/api/account/avatar/firma');
  assert.strictEqual(res.status, 501);
  assert.strictEqual(res.json.errorKey, 'errors.notImplemented');
});

test('avatar/confirmar: toca la fecha y devuelve la sesion re-hidratada', async () => {
  const res = await post('/api/account/avatar/confirmar');
  assert.deepStrictEqual(res.json, SESION_FALSA);
  assert.deepStrictEqual(llamadas, ['tocar-avatar:user-1', 'estado-cuenta:user-1']);
});

test('banner/confirmar: toca la fecha y devuelve la sesion re-hidratada', async () => {
  const res = await post('/api/account/banner/confirmar');
  assert.deepStrictEqual(res.json, SESION_FALSA);
  assert.deepStrictEqual(llamadas, ['tocar-banner:user-1', 'estado-cuenta:user-1']);
});
