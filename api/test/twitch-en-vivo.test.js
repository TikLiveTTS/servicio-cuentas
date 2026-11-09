'use strict';

// GET /api/twitch/live y twitch/consultar-en-vivo.js. Sin red: se stubbea el
// token de app y global.fetch (Helix).

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');

process.env.POSTGRES_URL = process.env.POSTGRES_URL || 'postgresql://u:p@localhost:5432/x';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'x'.repeat(32);
process.env.TWITCH_CLIENT_ID = 'cid';
process.env.TWITCH_CLIENT_SECRET = 'csecret';

function stub(mod, exp) {
  const p = require.resolve(mod);
  require.cache[p] = { id: p, filename: p, loaded: true, exports: exp };
}
stub('../src/twitch/token-app', { obtenerAppTokenTwitch: async () => 'app-token' });

const config = require('../src/config');
const consultar = require('../src/twitch/consultar-en-vivo');
const express = require('express');
const router = require('../src/routes/twitch-en-vivo');

const fetchReal = global.fetch;
let llamadasHelix;
let respuestaHelix; // { status, body }

beforeEach(() => {
  consultar._vaciarCache();
  config.twitchClientId = 'cid';
  config.twitchClientSecret = 'csecret';
  llamadasHelix = [];
  respuestaHelix = { status: 200, body: { data: [] } };
  global.fetch = async (url, opts) => {
    if (String(url).startsWith('https://api.twitch.tv/helix/streams')) {
      llamadasHelix.push({ url: String(url), headers: opts.headers });
      return {
        ok: respuestaHelix.status >= 200 && respuestaHelix.status < 300,
        status: respuestaHelix.status,
        json: async () => respuestaHelix.body,
        text: async () => JSON.stringify(respuestaHelix.body),
      };
    }
    return fetchReal(url, opts); // el pedido HTTP al server de prueba
  };
});

async function pedir(path) {
  const app = express();
  app.use('/api', router);
  const server = app.listen(0);
  try {
    const res = await fetchReal(`http://127.0.0.1:${server.address().port}${path}`);
    return { status: res.status, json: await res.json() };
  } finally {
    server.close();
  }
}

test('canal en vivo: live=true, manda token de app y Client-Id', async () => {
  respuestaHelix.body = { data: [{ type: 'live', user_login: 'ana' }] };
  assert.strictEqual(await consultar.twitchEnVivo('ana'), true);
  assert.match(llamadasHelix[0].url, /user_login=ana$/);
  assert.strictEqual(llamadasHelix[0].headers.Authorization, 'Bearer app-token');
  assert.strictEqual(llamadasHelix[0].headers['Client-Id'], 'cid');
});

test('canal offline (data vacio): live=false', async () => {
  assert.strictEqual(await consultar.twitchEnVivo('ana'), false);
});

test('cache: dos consultas seguidas al mismo canal pegan UNA vez a Twitch', async () => {
  await consultar.twitchEnVivo('ana');
  await consultar.twitchEnVivo('ana');
  assert.strictEqual(llamadasHelix.length, 1);
});

test('consultas simultaneas al mismo canal comparten una sola llamada', async () => {
  await Promise.all([consultar.twitchEnVivo('ana'), consultar.twitchEnVivo('ana'), consultar.twitchEnVivo('ana')]);
  assert.strictEqual(llamadasHelix.length, 1);
});

test('canales distintos no comparten cache', async () => {
  await consultar.twitchEnVivo('ana');
  await consultar.twitchEnVivo('beto');
  assert.strictEqual(llamadasHelix.length, 2);
});

test('un fallo de Twitch lanza y NO se cachea', async () => {
  respuestaHelix = { status: 500, body: {} };
  await assert.rejects(consultar.twitchEnVivo('ana'), /Twitch streams 500/);
  respuestaHelix = { status: 200, body: { data: [{ type: 'live' }] } };
  assert.strictEqual(await consultar.twitchEnVivo('ana'), true);
  assert.strictEqual(llamadasHelix.length, 2);
});

test('sin credenciales de Twitch: lanza twitch_no_configurado, sin llamar a Helix', async () => {
  config.twitchClientSecret = '';
  await assert.rejects(consultar.twitchEnVivo('ana'), (e) => e.code === 'twitch_no_configurado');
  assert.strictEqual(llamadasHelix.length, 0);
});

test('ruta: ok -> { live }', async () => {
  respuestaHelix.body = { data: [{ type: 'live' }] };
  const res = await pedir('/api/twitch/live?login=Ana');
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.json, { live: true });
  assert.match(llamadasHelix[0].url, /user_login=ana$/); // normaliza a minusculas
});

test('ruta: login invalido o ausente -> 400, no llama a Twitch', async () => {
  for (const q of ['', '?login=', '?login=a b', '?login=../x', `?login=${'a'.repeat(26)}`]) {
    const res = await pedir(`/api/twitch/live${q}`);
    assert.strictEqual(res.status, 400, q);
  }
  assert.strictEqual(llamadasHelix.length, 0);
});

test('ruta: Twitch no configurado -> 501', async () => {
  config.twitchClientId = '';
  const res = await pedir('/api/twitch/live?login=ana');
  assert.strictEqual(res.status, 501);
});

test('ruta: Twitch falla -> 502', async () => {
  respuestaHelix = { status: 503, body: {} };
  const res = await pedir('/api/twitch/live?login=ana');
  assert.strictEqual(res.status, 502);
  assert.strictEqual(res.json.errorKey, 'errors.serviceUnavailable');
});
