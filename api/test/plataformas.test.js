'use strict';

// POST /api/account/link/twitch|kick, GET /api/account/platforms,
// DELETE /api/account/link/:plataforma. Sin red ni DB: se stubbean los
// intercambios con Twitch/Kick, el cifrado y las queries.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');

process.env.POSTGRES_URL = process.env.POSTGRES_URL || 'postgresql://u:p@localhost:5432/x';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'x'.repeat(32);

const llamadas = [];

let perfilTwitch;
let perfilKick;
let fallaTwitch;
let fallaKick;
let plataformaPropia;
let plataformasListadas;
let fallaGuardar;

function stub(mod, exp) {
  const p = require.resolve(mod);
  require.cache[p] = { id: p, filename: p, loaded: true, exports: exp };
}

stub('../src/middleware/require-auth', { requireAuth: (req, res, next) => { req.userId = 'user-1'; next(); } });
stub('../src/middleware/rate-limit', { makeRateLimit: () => (req, res, next) => next() });
stub('../src/lib/cifrado', { cifrar: (texto) => `cifrado(${texto})` });

stub('../src/twitch/intercambiar-code', {
  intercambiarCodeTwitch: async () => {
    if (fallaTwitch) throw fallaTwitch;
    return perfilTwitch;
  },
});
stub('../src/kick/intercambiar-code', {
  intercambiarCodeKick: async () => {
    if (fallaKick) throw fallaKick;
    return perfilKick;
  },
});
stub('../src/queries/buscar-plataforma-usuario', { buscarPlataformaUsuario: async () => plataformaPropia });
stub('../src/queries/guardar-plataforma', {
  guardarPlataforma: async (args) => {
    if (fallaGuardar) throw fallaGuardar;
    llamadas.push(`guardar:${args.plataforma}:${args.userId}:${args.plataformaUserId}`);
    return { id: 'plataforma-nueva' };
  },
});
stub('../src/queries/listar-plataformas', { listarPlataformas: async () => plataformasListadas });
stub('../src/queries/desvincular-plataforma', {
  desvincularPlataforma: async (userId, plataforma) => { llamadas.push(`desvincular:${userId}:${plataforma}`); return true; },
});
// La suscripcion a eventos corre fire-and-forget despues de vincular (ver
// plataformas.js) -- sin stubbear, estos tests pegarian de verdad contra
// Twitch/Kick. Se registra en un array aparte: el orden respecto a la
// respuesta HTTP no esta garantizado (es fire-and-forget a proposito), asi
// que no se mezcla con `llamadas` para no armar un test fragil por timing.
const llamadasSuscribir = [];
stub('../src/twitch/suscribir-eventos', { suscribirEventosTwitch: async () => { llamadasSuscribir.push('twitch'); return []; } });
stub('../src/kick/suscribir-eventos', { suscribirEventosKick: async () => { llamadasSuscribir.push('kick'); return []; } });

const express = require('express');
const router = require('../src/routes/plataformas');

beforeEach(() => {
  llamadas.length = 0;
  llamadasSuscribir.length = 0;
  perfilTwitch = { userId: 'tw-1', username: 'frantwitch', accessToken: 'at', refreshToken: 'rt', expiresIn: 3600, scopes: ['user:read:chat'] };
  perfilKick = { userId: 'kk-1', username: 'frankick', accessToken: 'at', refreshToken: 'rt', expiresIn: 3600, scopes: ['user:read'] };
  fallaTwitch = null;
  fallaKick = null;
  plataformaPropia = null;
  plataformasListadas = [];
  fallaGuardar = null;
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

const linkTwitch = (body) => pedir('POST', '/api/account/link/twitch', body);
const linkKick = (body) => pedir('POST', '/api/account/link/kick', body);
const platforms = () => pedir('GET', '/api/account/platforms');
const unlink = (plataforma) => pedir('DELETE', `/api/account/link/${plataforma}`);

const TWITCH_BODY = { code: 'c', redirectUri: 'http://localhost:17623' };
const KICK_BODY = { code: 'c', codeVerifier: 'v', redirectUri: 'http://localhost:17624' };

test('link/twitch: vincula una cuenta nueva', async () => {
  const res = await linkTwitch(TWITCH_BODY);
  assert.deepStrictEqual(res.json, { ok: true });
  assert.deepStrictEqual(llamadas, ['guardar:twitch:user-1:tw-1']);
});

test('link/twitch: ya vinculada a la misma cuenta -> no-op', async () => {
  plataformaPropia = { plataforma_user_id: 'tw-1', plataforma_username: 'frantwitch' };
  const res = await linkTwitch(TWITCH_BODY);
  assert.deepStrictEqual(res.json, { ok: true });
  assert.deepStrictEqual(llamadas, []);
});

test('link/twitch: el usuario ya tiene OTRA cuenta de Twitch vinculada -> 409', async () => {
  plataformaPropia = { plataforma_user_id: 'tw-otro', plataforma_username: 'otro' };
  const res = await linkTwitch(TWITCH_BODY);
  assert.strictEqual(res.status, 409);
  assert.strictEqual(res.json.errorKey, 'errors.plataformaTomada');
  assert.deepStrictEqual(llamadas, []);
});

test('link/twitch: esa cuenta ya esta vinculada a otro usuario (carrera) -> 409', async () => {
  fallaGuardar = Object.assign(new Error('dup'), { code: 'plataforma_tomada' });
  const res = await linkTwitch(TWITCH_BODY);
  assert.strictEqual(res.status, 409);
  assert.strictEqual(res.json.errorKey, 'errors.plataformaTomada');
});

test('link/twitch: Twitch no configurado -> 501', async () => {
  fallaTwitch = Object.assign(new Error('sin credenciales'), { code: 'twitch_no_configurado' });
  const res = await linkTwitch(TWITCH_BODY);
  assert.strictEqual(res.status, 501);
});

test('link/twitch: code invalido -> 400', async () => {
  fallaTwitch = Object.assign(new Error('rechazado'), { code: 'twitch_token_invalido' });
  const res = await linkTwitch(TWITCH_BODY);
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.json.errorKey, 'errors.invalidPlatformToken');
});

test('link/kick: vincula una cuenta nueva', async () => {
  const res = await linkKick(KICK_BODY);
  assert.deepStrictEqual(res.json, { ok: true });
  assert.deepStrictEqual(llamadas, ['guardar:kick:user-1:kk-1']);
});

test('link/kick: faltan campos (sin codeVerifier) -> 400', async () => {
  const res = await linkKick({ code: 'c', redirectUri: 'http://localhost:17624' });
  assert.strictEqual(res.status, 400);
  assert.deepStrictEqual(llamadas, []);
});

test('platforms: mapea plataforma/username/linkedAt', async () => {
  plataformasListadas = [{ plataforma: 'twitch', plataforma_username: 'frantwitch', created_at: '2026-01-01T00:00:00.000Z' }];
  const res = await platforms();
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.json, {
    platforms: [{ plataforma: 'twitch', username: 'frantwitch', linkedAt: '2026-01-01T00:00:00.000Z' }],
  });
});

test('desvincular: plataforma valida -> ok y llama a la query', async () => {
  const res = await unlink('twitch');
  assert.deepStrictEqual(res.json, { ok: true });
  assert.deepStrictEqual(llamadas, ['desvincular:user-1:twitch']);
});

test('desvincular: plataforma invalida -> 400, no llama nada', async () => {
  const res = await unlink('youtube');
  assert.strictEqual(res.status, 400);
  assert.deepStrictEqual(llamadas, []);
});
