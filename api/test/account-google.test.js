'use strict';

// POST /api/account/link/google, GET /api/account/identities, y el camino
// de DELETE /api/account para cuentas sin password (re-autenticando con
// Google). Sin red ni DB: se stubbean queries y el intercambio con Google.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');

process.env.POSTGRES_URL = process.env.POSTGRES_URL || 'postgresql://u:p@localhost:5432/x';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'x'.repeat(32);

const PASSWORD = 'clave-secreta-123';
const llamadas = [];

let hashGuardado;
let identidadPropia;
let identidadesListadas;
let perfilGoogle;
let fallaIntercambio;
let fallaVincular;

function stub(mod, exp) {
  const p = require.resolve(mod);
  require.cache[p] = { id: p, filename: p, loaded: true, exports: exp };
}

stub('../src/middleware/require-auth', { requireAuth: (req, res, next) => { req.userId = 'user-1'; next(); } });
stub('../src/middleware/rate-limit', { makeRateLimit: () => (req, res, next) => next() });
stub('../src/queries/actualizar-cuenta', { actualizarCuenta: async () => null });
stub('../src/account/eliminar-cuenta', { eliminarCuenta: async (id) => { llamadas.push(`borrar:${id}`); } });

stub('../src/queries/buscar-password-hash', { buscarPasswordHash: async () => hashGuardado });
stub('../src/auth/verificar-password', { verificarPassword: async (plain) => plain === PASSWORD });

stub('../src/auth/google', {
  intercambiarCodeGoogle: async () => {
    if (fallaIntercambio) throw fallaIntercambio;
    return perfilGoogle;
  },
});
stub('../src/queries/buscar-identidad-usuario', { buscarIdentidadUsuario: async () => identidadPropia });
stub('../src/queries/vincular-identidad', {
  vincularIdentidad: async (args) => {
    if (fallaVincular) throw fallaVincular;
    llamadas.push(`vincular:${args.userId}:${args.providerUserId}`);
    return { id: 'identidad-nueva' };
  },
});
stub('../src/queries/listar-identidades', { listarIdentidades: async () => identidadesListadas });

const express = require('express');
const router = require('../src/routes/account');

beforeEach(() => {
  llamadas.length = 0;
  hashGuardado = 'hash-guardado';
  identidadPropia = null;
  identidadesListadas = [];
  perfilGoogle = { sub: 'g-1', email: 'fran@gmail.com', emailVerified: true, name: 'Fran' };
  fallaIntercambio = null;
  fallaVincular = null;
});

async function pedir(method, path, body) {
  const app = express();
  app.use(express.json());
  app.use('/api', router);
  const server = app.listen(0);
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, json: await res.json() };
  } finally {
    server.close();
  }
}

const GOOGLE_BODY = { code: 'c', codeVerifier: 'v', redirectUri: 'http://127.0.0.1:5000' };
const linkGoogle = (body) => pedir('POST', '/api/account/link/google', body);
const identidades = () => pedir('GET', '/api/account/identities');
const eliminar = (body) => pedir('DELETE', '/api/account', body);

// ---- POST /api/account/link/google ----

test('link/google: vincula una identidad nueva', async () => {
  const res = await linkGoogle(GOOGLE_BODY);
  assert.deepStrictEqual(res.json, { ok: true });
  assert.deepStrictEqual(llamadas, ['vincular:user-1:g-1']);
});

test('link/google: ya vinculada a la misma cuenta -> no-op, no reinserta', async () => {
  identidadPropia = { provider_user_id: 'g-1', email: 'fran@gmail.com' };
  const res = await linkGoogle(GOOGLE_BODY);
  assert.deepStrictEqual(res.json, { ok: true });
  assert.deepStrictEqual(llamadas, []);
});

test('link/google: el usuario ya tiene OTRA cuenta de Google vinculada -> 409', async () => {
  identidadPropia = { provider_user_id: 'g-otro', email: 'otro@gmail.com' };
  const res = await linkGoogle(GOOGLE_BODY);
  assert.strictEqual(res.status, 409);
  assert.strictEqual(res.json.errorKey, 'errors.identidadTomada');
  assert.deepStrictEqual(llamadas, []);
});

test('link/google: esa cuenta de Google ya esta vinculada a otro usuario (carrera) -> 409', async () => {
  fallaVincular = Object.assign(new Error('dup'), { code: 'identidad_tomada' });
  const res = await linkGoogle(GOOGLE_BODY);
  assert.strictEqual(res.status, 409);
  assert.strictEqual(res.json.errorKey, 'errors.identidadTomada');
});

test('link/google: email no verificado -> 400', async () => {
  perfilGoogle = { sub: 'g-1', email: 'fran@gmail.com', emailVerified: false, name: 'Fran' };
  const res = await linkGoogle(GOOGLE_BODY);
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.json.errorKey, 'errors.googleEmailNoVerificado');
});

test('link/google: Google no configurado -> 501', async () => {
  fallaIntercambio = Object.assign(new Error('sin credenciales'), { code: 'google_no_configurado' });
  const res = await linkGoogle(GOOGLE_BODY);
  assert.strictEqual(res.status, 501);
});

test('link/google: faltan campos en el body -> 400', async () => {
  const res = await linkGoogle({ code: 'c' });
  assert.strictEqual(res.status, 400);
  assert.deepStrictEqual(llamadas, []);
});

// ---- GET /api/account/identities ----

test('identities: mapea provider/email/linkedAt', async () => {
  identidadesListadas = [{ provider: 'google', email: 'fran@gmail.com', created_at: '2026-01-01T00:00:00.000Z' }];
  const res = await identidades();
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.json, {
    identities: [{ provider: 'google', email: 'fran@gmail.com', linkedAt: '2026-01-01T00:00:00.000Z' }],
  });
});

// ---- DELETE /api/account ----

test('borrado con password: sigue funcionando igual que antes', async () => {
  const res = await eliminar({ password: PASSWORD });
  assert.deepStrictEqual(res.json, { ok: true });
  assert.deepStrictEqual(llamadas, ['borrar:user-1']);
});

test('borrado sin password ni code: 400, no borra', async () => {
  const res = await eliminar({});
  assert.strictEqual(res.status, 400);
  assert.deepStrictEqual(llamadas, []);
});

test('borrado con code: el sub coincide con la identidad vinculada -> borra', async () => {
  hashGuardado = null; // cuenta 100% Google, sin password
  identidadPropia = { provider_user_id: 'g-1', email: 'fran@gmail.com' };
  const res = await eliminar(GOOGLE_BODY);
  assert.deepStrictEqual(res.json, { ok: true });
  assert.deepStrictEqual(llamadas, ['borrar:user-1']);
});

test('borrado con code: el sub NO coincide con la identidad vinculada -> 403, no borra', async () => {
  hashGuardado = null;
  identidadPropia = { provider_user_id: 'g-otro', email: 'otro@gmail.com' };
  const res = await eliminar(GOOGLE_BODY);
  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.json.errorKey, 'errors.wrongPassword');
  assert.deepStrictEqual(llamadas, []);
});

test('borrado con code: usuario sin ninguna identidad vinculada -> 403, no borra', async () => {
  hashGuardado = null;
  identidadPropia = null;
  const res = await eliminar(GOOGLE_BODY);
  assert.strictEqual(res.status, 403);
  assert.deepStrictEqual(llamadas, []);
});
