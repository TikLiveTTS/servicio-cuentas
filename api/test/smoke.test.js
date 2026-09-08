'use strict';

// Smoke test: el servicio se cablea entero (config, rutas, middleware) sin
// necesitar Postgres. No cubre logica de negocio — eso es del agente 06 (QA e2e).

const { test } = require('node:test');
const assert = require('node:assert');

// Env minimo para que config.js no haga process.exit(1).
process.env.POSTGRES_URL = process.env.POSTGRES_URL || 'postgresql://u:p@localhost:5432/x';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'x'.repeat(32);

test('config carga con env minimo', () => {
  const config = require('../src/config');
  assert.equal(config.dbSchema, 'cuentas');
  assert.equal(config.sessionHours, 720);
});

test('todas las rutas exportan un router de express', () => {
  for (const r of ['health', 'register', 'login', 'logout', 'session', 'entitlements', 'account', 'checkout', 'webhook-polar']) {
    const router = require(`../src/routes/${r}`);
    assert.equal(typeof router, 'function', `${r} deberia exportar un router`);
  }
});

test('generar-token da 43 chars base64url', () => {
  const { generarToken } = require('../src/auth/generar-token');
  const t = generarToken();
  assert.match(t, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(generarToken(), generarToken());
});

test('hash y verificacion de password', async () => {
  const { hashPassword } = require('../src/auth/hash-password');
  const { verificarPassword } = require('../src/auth/verificar-password');
  const h = await hashPassword('secreto123');
  assert.ok(await verificarPassword('secreto123', h));
  assert.ok(!(await verificarPassword('otra', h)));
});

test('verificar-firma lanza claro si Polar no esta configurado', () => {
  const { verificarFirma } = require('../src/polar/verificar-firma');
  assert.throws(() => verificarFirma('{}', {}), /POLAR_WEBHOOK_SECRET/);
});
