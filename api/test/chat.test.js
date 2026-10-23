'use strict';

// POST /api/platforms/twitch|kick/chat. Sin red ni DB: se stubbea el token
// vigente, la busqueda de la plataforma propia, y el envio en si.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');

process.env.POSTGRES_URL = process.env.POSTGRES_URL || 'postgresql://u:p@localhost:5432/x';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'x'.repeat(32);

const llamadas = [];
let fallaToken;
let fallaEnvioTwitch;
let fallaEnvioKick;

function stub(mod, exp) {
  const p = require.resolve(mod);
  require.cache[p] = { id: p, filename: p, loaded: true, exports: exp };
}

stub('../src/middleware/require-auth', { requireAuth: (req, res, next) => { req.userId = 'user-1'; next(); } });
stub('../src/middleware/rate-limit', { makeRateLimit: () => (req, res, next) => next() });
stub('../src/lib/token-plataforma', {
  obtenerAccessTokenVigente: async () => {
    if (fallaToken) throw fallaToken;
    return 'access-token-vigente';
  },
});
stub('../src/queries/buscar-plataforma-usuario', {
  buscarPlataformaUsuario: async (userId, plataforma) => ({ plataforma_user_id: `${plataforma}-canal-1` }),
});
stub('../src/twitch/enviar-mensaje', {
  enviarMensajeTwitch: async (args) => {
    if (fallaEnvioTwitch) throw fallaEnvioTwitch;
    llamadas.push(`twitch:${args.broadcasterId}:${args.mensaje}`);
  },
});
stub('../src/kick/enviar-mensaje', {
  enviarMensajeKick: async (args) => {
    if (fallaEnvioKick) throw fallaEnvioKick;
    llamadas.push(`kick:${args.broadcasterId}:${args.mensaje}`);
  },
});

const express = require('express');
const router = require('../src/routes/chat');

beforeEach(() => {
  llamadas.length = 0;
  fallaToken = null;
  fallaEnvioTwitch = null;
  fallaEnvioKick = null;
});

async function post(path, body) {
  const app = express();
  app.use(express.json());
  app.use('/api', router);
  const server = app.listen(0);
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: await res.json() };
  } finally {
    server.close();
  }
}

test('twitch/chat: manda el mensaje al canal propio', async () => {
  const res = await post('/api/platforms/twitch/chat', { mensaje: 'hola' });
  assert.deepStrictEqual(res.json, { ok: true });
  assert.deepStrictEqual(llamadas, ['twitch:twitch-canal-1:hola']);
});

test('kick/chat: manda el mensaje al canal propio', async () => {
  const res = await post('/api/platforms/kick/chat', { mensaje: 'hola' });
  assert.deepStrictEqual(res.json, { ok: true });
  assert.deepStrictEqual(llamadas, ['kick:kick-canal-1:hola']);
});

test('sin mensaje en el body: 400, no manda nada', async () => {
  const res = await post('/api/platforms/twitch/chat', {});
  assert.strictEqual(res.status, 400);
  assert.deepStrictEqual(llamadas, []);
});

test('plataforma no vinculada: 409', async () => {
  fallaToken = Object.assign(new Error('no vinculado'), { code: 'plataforma_no_vinculada' });
  const res = await post('/api/platforms/twitch/chat', { mensaje: 'hola' });
  assert.strictEqual(res.status, 409);
  assert.strictEqual(res.json.errorKey, 'errors.plataformaNoVinculada');
});

test('refresh invalido (conexion cortada): 409, manda a reconectar', async () => {
  fallaToken = Object.assign(new Error('refresh rechazado'), { code: 'twitch_refresh_invalido' });
  const res = await post('/api/platforms/twitch/chat', { mensaje: 'hola' });
  assert.strictEqual(res.status, 409);
  assert.strictEqual(res.json.errorKey, 'errors.plataformaDesconectada');
});

test('la plataforma rechaza el mensaje: 502', async () => {
  fallaEnvioTwitch = new Error('Twitch 400');
  const res = await post('/api/platforms/twitch/chat', { mensaje: 'hola' });
  assert.strictEqual(res.status, 502);
  assert.strictEqual(res.json.errorKey, 'errors.chatEnvioFallido');
});
