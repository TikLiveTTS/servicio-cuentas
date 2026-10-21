'use strict';

// POST /api/webhooks/twitch. Sin red ni DB: se stubbea la verificacion de
// firma, la busqueda de usuario por plataforma y el relay en tiempo real.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');

process.env.POSTGRES_URL = process.env.POSTGRES_URL || 'postgresql://u:p@localhost:5432/x';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'x'.repeat(32);

const llamadas = [];
let firmaValida;
let fallaVerificar;
let usuarioDelCanal;

function stub(mod, exp) {
  const p = require.resolve(mod);
  require.cache[p] = { id: p, filename: p, loaded: true, exports: exp };
}

stub('../src/twitch/verificar-firma', {
  verificarFirmaTwitch: () => {
    if (fallaVerificar) throw fallaVerificar;
    return firmaValida;
  },
});
stub('../src/queries/buscar-usuario-por-plataforma', {
  buscarUsuarioPorPlataforma: async () => usuarioDelCanal,
});
stub('../src/realtime/servidor', {
  enviarEventoAUsuario: (userId, evento) => { llamadas.push(`enviar:${userId}:${evento.tipo}`); },
});

const express = require('express');
const router = require('../src/routes/webhook-twitch');

beforeEach(() => {
  llamadas.length = 0;
  firmaValida = true;
  fallaVerificar = null;
  usuarioDelCanal = 'user-1';
});

async function post(body, headers) {
  const app = express();
  app.use('/api', router);
  const server = app.listen(0);
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/webhooks/twitch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    return { status: res.status, text: await res.text() };
  } finally {
    server.close();
  }
}

test('firma invalida: 403, no reenvia nada', async () => {
  firmaValida = false;
  const res = await post({ event: { broadcaster_user_id: '123' } });
  assert.strictEqual(res.status, 403);
  assert.deepStrictEqual(llamadas, []);
});

test('webhook no configurado: 501', async () => {
  fallaVerificar = Object.assign(new Error('sin secreto'), { code: 'twitch_webhook_no_configurado' });
  const res = await post({ event: {} });
  assert.strictEqual(res.status, 501);
});

test('desafio de verificacion: devuelve el challenge en texto plano', async () => {
  const res = await post({ challenge: 'abc123' }, { 'Twitch-Eventsub-Message-Type': 'webhook_callback_verification' });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.text, 'abc123');
});

test('evento con canal vinculado: reenvia por el canal en tiempo real', async () => {
  const res = await post(
    { subscription: { type: 'channel.chat.message' }, event: { broadcaster_user_id: '123' } },
    { 'Twitch-Eventsub-Message-Type': 'notification' }
  );
  assert.strictEqual(res.status, 204);
  assert.deepStrictEqual(llamadas, ['enviar:user-1:channel.chat.message']);
});

test('evento de un canal que no esta vinculado a nadie: 204, no reenvia', async () => {
  usuarioDelCanal = null;
  const res = await post(
    { subscription: { type: 'channel.cheer' }, event: { broadcaster_user_id: '999' } },
    { 'Twitch-Eventsub-Message-Type': 'notification' }
  );
  assert.strictEqual(res.status, 204);
  assert.deepStrictEqual(llamadas, []);
});
