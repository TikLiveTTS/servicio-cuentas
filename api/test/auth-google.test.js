'use strict';

// POST /api/auth/google: login si la identidad ya esta vinculada, alta
// nueva si no existe ni la identidad ni un usuario con ese email, y 409 si
// el email ya pertenece a una cuenta sin Google vinculado (no autologuea ni
// vincula solo). Sin red ni DB: se stubbean el intercambio con Google y las
// queries.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');

process.env.POSTGRES_URL = process.env.POSTGRES_URL || 'postgresql://u:p@localhost:5432/x';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'x'.repeat(32);

const llamadas = [];

let perfilGoogle;
let fallaIntercambio;
let identidadExistente;
let usuarioExistentePorEmail;

function stub(mod, exp) {
  const p = require.resolve(mod);
  require.cache[p] = { id: p, filename: p, loaded: true, exports: exp };
}

stub('../src/middleware/rate-limit', { makeRateLimit: () => (req, res, next) => next() });

stub('../src/auth/google', {
  intercambiarCodeGoogle: async () => {
    if (fallaIntercambio) throw fallaIntercambio;
    return perfilGoogle;
  },
});
stub('../src/queries/buscar-identidad', { buscarIdentidad: async () => identidadExistente });
stub('../src/queries/buscar-usuario-por-email', { buscarUsuarioPorEmail: async () => usuarioExistentePorEmail });
stub('../src/queries/crear-usuario', {
  crearUsuario: async ({ email, passwordHash, nombre }) => {
    llamadas.push(`crear-usuario:${email}:${passwordHash === null ? 'sin-password' : 'con-password'}`);
    return { id: 'user-nuevo', email, nombre, created_at: new Date().toISOString() };
  },
});
stub('../src/queries/vincular-identidad', {
  vincularIdentidad: async ({ userId, providerUserId }) => {
    llamadas.push(`vincular:${userId}:${providerUserId}`);
    return { id: 'identidad-nueva' };
  },
});
stub('../src/queries/crear-sesion', {
  crearSesion: async (userId) => {
    llamadas.push(`sesion:${userId}`);
    return { token: 'tok-1', expiresAt: new Date('2026-12-01') };
  },
});
stub('../src/queries/estado-cuenta', {
  estadoCuenta: async (userId) => ({
    user: { id: userId, email: 'x', nombre: 'x' },
    plan: 'free',
    entitlements: [],
    subscription: null,
  }),
});

const express = require('express');
const router = require('../src/routes/auth-google');

beforeEach(() => {
  llamadas.length = 0;
  perfilGoogle = { sub: 'g-1', email: 'fran@gmail.com', emailVerified: true, name: 'Fran' };
  fallaIntercambio = null;
  identidadExistente = null;
  usuarioExistentePorEmail = null;
});

async function loginGoogle(body) {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', router); // mismo prefijo que index.js
  const server = app.listen(0);
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: await res.json() };
  } finally {
    server.close();
  }
}

const BODY = { code: 'c', codeVerifier: 'v', redirectUri: 'http://127.0.0.1:5000' };

test('identidad ya vinculada: loguea sin crear nada', async () => {
  identidadExistente = { user_id: 'user-viejo', email: 'fran@gmail.com' };
  const res = await loginGoogle(BODY);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.json.token, 'tok-1');
  assert.deepStrictEqual(llamadas, ['sesion:user-viejo']);
});

test('sin identidad ni usuario con ese email: alta nueva sin password', async () => {
  const res = await loginGoogle(BODY);
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(llamadas, [
    'crear-usuario:fran@gmail.com:sin-password',
    'vincular:user-nuevo:g-1',
    'sesion:user-nuevo',
  ]);
});

test('el email ya tiene una cuenta sin Google vinculado: 409, no crea ni vincula', async () => {
  usuarioExistentePorEmail = { id: 'user-con-password', email: 'fran@gmail.com' };
  const res = await loginGoogle(BODY);
  assert.strictEqual(res.status, 409);
  assert.strictEqual(res.json.errorKey, 'errors.googleEmailYaRegistrado');
  assert.deepStrictEqual(llamadas, []);
});

test('email de Google no verificado: 400, no toca la DB', async () => {
  perfilGoogle = { sub: 'g-1', email: 'fran@gmail.com', emailVerified: false, name: 'Fran' };
  const res = await loginGoogle(BODY);
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.json.errorKey, 'errors.googleEmailNoVerificado');
  assert.deepStrictEqual(llamadas, []);
});

test('Google no configurado: 501', async () => {
  fallaIntercambio = Object.assign(new Error('sin credenciales'), { code: 'google_no_configurado' });
  const res = await loginGoogle(BODY);
  assert.strictEqual(res.status, 501);
});

test('code invalido: 400 errors.invalidGoogleToken', async () => {
  fallaIntercambio = Object.assign(new Error('rechazado'), { code: 'google_token_invalido' });
  const res = await loginGoogle(BODY);
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.json.errorKey, 'errors.invalidGoogleToken');
});

test('faltan campos en el body: 400', async () => {
  const res = await loginGoogle({ code: 'c' });
  assert.strictEqual(res.status, 400);
  assert.deepStrictEqual(llamadas, []);
});
