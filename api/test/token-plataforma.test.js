'use strict';

// obtenerAccessTokenVigente: no renueva si todavia falta para vencer,
// renueva (y guarda cifrado) si esta por vencer, y propaga el error si el
// refresh es rechazado. Sin red ni DB: se stubbean cifrado, las queries y
// los refrescos de Twitch/Kick.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');

process.env.POSTGRES_URL = process.env.POSTGRES_URL || 'postgresql://u:p@localhost:5432/x';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'x'.repeat(32);

const llamadas = [];
let filaGuardada;
let fallaRefreshTwitch;

function stub(mod, exp) {
  const p = require.resolve(mod);
  require.cache[p] = { id: p, filename: p, loaded: true, exports: exp };
}

stub('../src/lib/cifrado', {
  cifrar: (texto) => `cifrado(${texto})`,
  descifrar: (valor) => valor.replace(/^cifrado\(/, '').replace(/\)$/, ''),
});
stub('../src/queries/buscar-tokens-plataforma', { buscarTokensPlataforma: async () => filaGuardada });
stub('../src/queries/actualizar-tokens-plataforma', {
  actualizarTokensPlataforma: async (args) => { llamadas.push(`actualizar:${args.plataforma}:${args.userId}`); },
});
stub('../src/twitch/refrescar-token', {
  refrescarTokenTwitch: async () => {
    if (fallaRefreshTwitch) throw fallaRefreshTwitch;
    llamadas.push('refrescar:twitch');
    return { accessToken: 'at-nuevo', refreshToken: 'rt-nuevo', expiresIn: 3600 };
  },
});
stub('../src/kick/refrescar-token', {
  refrescarTokenKick: async () => { llamadas.push('refrescar:kick'); return { accessToken: 'at-nuevo', refreshToken: 'rt-nuevo', expiresIn: 3600 }; },
});

const { obtenerAccessTokenVigente } = require('../src/lib/token-plataforma');

beforeEach(() => {
  llamadas.length = 0;
  fallaRefreshTwitch = null;
  filaGuardada = {
    access_token_cifrado: 'cifrado(at-viejo)',
    refresh_token_cifrado: 'cifrado(rt-viejo)',
    expires_at: new Date(Date.now() + 3600 * 1000), // vence en 1h, no hace falta renovar
  };
});

test('token vigente: devuelve el access token sin renovar', async () => {
  const token = await obtenerAccessTokenVigente('user-1', 'twitch');
  assert.strictEqual(token, 'at-viejo');
  assert.deepStrictEqual(llamadas, []);
});

test('token por vencer: renueva, guarda cifrado y devuelve el nuevo', async () => {
  filaGuardada.expires_at = new Date(Date.now() + 60 * 1000); // vence en 1 min
  const token = await obtenerAccessTokenVigente('user-1', 'twitch');
  assert.strictEqual(token, 'at-nuevo');
  assert.deepStrictEqual(llamadas, ['refrescar:twitch', 'actualizar:twitch:user-1']);
});

test('usuario sin esa plataforma vinculada: lanza plataforma_no_vinculada', async () => {
  filaGuardada = null;
  await assert.rejects(
    () => obtenerAccessTokenVigente('user-1', 'twitch'),
    (err) => err.code === 'plataforma_no_vinculada'
  );
});

test('Twitch rechaza el refresh: propaga twitch_refresh_invalido, no actualiza nada', async () => {
  filaGuardada.expires_at = new Date(Date.now() + 60 * 1000);
  fallaRefreshTwitch = Object.assign(new Error('rechazado'), { code: 'twitch_refresh_invalido' });
  await assert.rejects(
    () => obtenerAccessTokenVigente('user-1', 'twitch'),
    (err) => err.code === 'twitch_refresh_invalido'
  );
  assert.deepStrictEqual(llamadas, []);
});
