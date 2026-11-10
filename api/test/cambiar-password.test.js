'use strict';

// PATCH /api/account/password: cambiar la contraseña con la sesion iniciada
// (exige la actual). Sin red ni DB: se stubbean las queries y el hash.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');

process.env.POSTGRES_URL = process.env.POSTGRES_URL || 'postgresql://u:p@localhost:5432/x';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'x'.repeat(32);

const ACTUAL = 'clave-actual-123';
const llamadas = [];
let hashGuardado;

function stub(mod, exp) {
  const p = require.resolve(mod);
  require.cache[p] = { id: p, filename: p, loaded: true, exports: exp };
}

stub('../src/middleware/require-auth', {
  requireAuth: (req, res, next) => { req.userId = 'user-1'; req.token = 'token-actual'; next(); },
});
stub('../src/middleware/rate-limit', { makeRateLimit: () => (req, res, next) => next() });
stub('../src/queries/buscar-password-hash', { buscarPasswordHash: async () => hashGuardado });
stub('../src/auth/verificar-password', { verificarPassword: async (plain) => plain === ACTUAL });
stub('../src/auth/hash-password', { hashPassword: async (plain) => `hash(${plain})` });
stub('../src/queries/actualizar-password', {
  actualizarPassword: async (userId, hash) => { llamadas.push(`guardar:${userId}:${hash}`); },
});
stub('../src/queries/invalidar-sesion', {
  invalidarOtrasSesiones: async (userId, token) => { llamadas.push(`cerrar-otras:${userId}:except=${token}`); },
});

const express = require('express');
const router = require('../src/routes/cambiar-password');

beforeEach(() => {
  llamadas.length = 0;
  hashGuardado = 'hash-viejo';
});

async function patch(body) {
  const app = express();
  app.use(express.json());
  app.use('/api', router);
  const server = app.listen(0);
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/account/password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: await res.json() };
  } finally {
    server.close();
  }
}

test('contraseña actual correcta: guarda el hash NUEVO y cierra las otras sesiones (la actual sigue)', async () => {
  const res = await patch({ currentPassword: ACTUAL, newPassword: 'clave-nueva-456' });
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.json, { ok: true });
  assert.deepStrictEqual(llamadas, ['guardar:user-1:hash(clave-nueva-456)', 'cerrar-otras:user-1:except=token-actual']);
});

test('contraseña actual incorrecta: 403 wrongPassword, no guarda nada ni cierra sesiones', async () => {
  const res = await patch({ currentPassword: 'otra-cosa', newPassword: 'clave-nueva-456' });
  assert.strictEqual(res.status, 403, '403 y no 401: el front trata 401 como sesion vencida');
  assert.strictEqual(res.json.errorKey, 'errors.wrongPassword');
  assert.deepStrictEqual(llamadas, []);
});

test('contraseña nueva corta (<8): 400 weakPassword, ni siquiera consulta la actual', async () => {
  const res = await patch({ currentPassword: ACTUAL, newPassword: '1234567' });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.json.errorKey, 'errors.weakPassword');
  assert.deepStrictEqual(llamadas, []);
});

test('exactamente 8 caracteres si se acepta', async () => {
  const res = await patch({ currentPassword: ACTUAL, newPassword: '12345678' });
  assert.strictEqual(res.status, 200);
});

test('cuenta sin contraseña (nacio con Google): 409 sinPassword, no guarda nada', async () => {
  hashGuardado = null;
  const res = await patch({ currentPassword: ACTUAL, newPassword: 'clave-nueva-456' });
  assert.strictEqual(res.status, 409);
  assert.strictEqual(res.json.errorKey, 'errors.sinPassword');
  assert.deepStrictEqual(llamadas, []);
});

test('faltan campos: 400 invalidBody', async () => {
  for (const body of [{}, { currentPassword: ACTUAL }, { newPassword: 'clave-nueva-456' }, { currentPassword: '', newPassword: 'x'.repeat(10) }]) {
    const res = await patch(body);
    assert.strictEqual(res.status, 400, JSON.stringify(body));
    assert.strictEqual(res.json.errorKey, 'errors.invalidBody');
  }
  assert.deepStrictEqual(llamadas, []);
});

test('el error no filtra ni la contraseña actual ni la nueva', async () => {
  const res = await patch({ currentPassword: 'intento-secreto', newPassword: 'clave-nueva-456' });
  const texto = JSON.stringify(res.json);
  assert.ok(!texto.includes('intento-secreto') && !texto.includes('clave-nueva-456'));
});
