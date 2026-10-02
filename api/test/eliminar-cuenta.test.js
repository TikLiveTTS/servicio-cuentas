'use strict';

// DELETE /api/account: contrasena, orden Polar -> borrado, y que no se loguee
// la contrasena. Sin red ni DB: se stubbean queries y llamadas a Polar.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');

process.env.POSTGRES_URL = process.env.POSTGRES_URL || 'postgresql://u:p@localhost:5432/x';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'x'.repeat(32);

const PASSWORD = 'clave-secreta-123';
const llamadas = [];
let suscripciones;
let fallaRevocar;
let fallaCliente;

function stub(mod, exp) {
  const p = require.resolve(mod);
  require.cache[p] = { id: p, filename: p, loaded: true, exports: exp };
}
stub('../src/middleware/require-auth', { requireAuth: (req, res, next) => { req.userId = 'user-1'; next(); } });
// El limite por usuario se prueba aparte; aca todos los tests son el mismo user-1.
stub('../src/middleware/rate-limit', { makeRateLimit: () => (req, res, next) => next() });
stub('../src/queries/actualizar-cuenta', { actualizarCuenta: async () => null });
stub('../src/queries/buscar-password-hash', { buscarPasswordHash: async () => 'hash-guardado' });
stub('../src/auth/verificar-password', { verificarPassword: async (plain) => plain === PASSWORD });
stub('../src/queries/suscripciones-polar-vigentes', { suscripcionesPolarVigentes: async () => suscripciones });
stub('../src/polar/revocar-suscripcion', {
  revocarSuscripcion: async (id) => { llamadas.push(`revocar:${id}`); if (fallaRevocar) throw fallaRevocar; },
});
stub('../src/polar/eliminar-cliente', {
  eliminarCliente: async (id) => { llamadas.push(`cliente:${id}`); if (fallaCliente) throw fallaCliente; },
});
stub('../src/queries/eliminar-usuario', { eliminarUsuario: async (id) => { llamadas.push(`usuario:${id}`); } });

const express = require('express');
const router = require('../src/routes/account');

beforeEach(() => {
  llamadas.length = 0;
  suscripciones = [];
  fallaRevocar = null;
  fallaCliente = null;
});

async function eliminar(body) {
  const app = express();
  app.use(express.json());
  app.use('/api', router);
  const server = app.listen(0);
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/account`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: await res.json() };
  } finally {
    server.close();
  }
}

// Captura console.log/error durante fn() para inspeccionar lo logueado.
async function conLogsCapturados(fn) {
  const lineas = [];
  const originales = { log: console.log, error: console.error };
  console.log = (...a) => lineas.push(a.join(' '));
  console.error = (...a) => lineas.push(a.join(' '));
  try {
    await fn();
  } finally {
    Object.assign(console, originales);
  }
  return lineas;
}

test('contrasena incorrecta: 403 errors.wrongPassword y no borra nada', async () => {
  suscripciones = ['sub-1'];
  const res = await eliminar({ password: 'otra' });
  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.json.errorKey, 'errors.wrongPassword');
  assert.deepStrictEqual(llamadas, []);
});

test('sin password en el body: 400 y no borra nada', async () => {
  const res = await eliminar({});
  assert.strictEqual(res.status, 400);
  assert.deepStrictEqual(llamadas, []);
});

test('exito sin suscripcion: borra customer y usuario, responde ok', async () => {
  const res = await eliminar({ password: PASSWORD });
  assert.deepStrictEqual(res.json, { ok: true });
  assert.deepStrictEqual(llamadas, ['cliente:user-1', 'usuario:user-1']);
});

test('exito con suscripciones: revoca todas antes de borrar customer y usuario', async () => {
  suscripciones = ['sub-1', 'sub-2'];
  const res = await eliminar({ password: PASSWORD });
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(llamadas, ['revocar:sub-1', 'revocar:sub-2', 'cliente:user-1', 'usuario:user-1']);
});

test('fallo al revocar en Polar: 502 y NO se borra el usuario', async () => {
  suscripciones = ['sub-1'];
  fallaRevocar = Object.assign(new Error('Polar 500'), { status: 500 });
  const res = await eliminar({ password: PASSWORD });
  assert.strictEqual(res.status, 502);
  assert.strictEqual(res.json.errorKey, 'errors.polarUnavailable');
  assert.deepStrictEqual(llamadas, ['revocar:sub-1']);
});

test('Polar sin configurar con suscripcion: 501 y NO se borra el usuario', async () => {
  suscripciones = ['sub-1'];
  fallaRevocar = Object.assign(new Error('sin key'), { code: 'polar_no_configurado' });
  const res = await eliminar({ password: PASSWORD });
  assert.strictEqual(res.status, 501);
  assert.ok(!llamadas.includes('usuario:user-1'));
});

test('fallo al borrar el customer en Polar: se loguea y igual se borra el usuario', async () => {
  fallaCliente = Object.assign(new Error('Polar 500'), { status: 500 });
  let res;
  const lineas = await conLogsCapturados(async () => { res = await eliminar({ password: PASSWORD }); });
  assert.deepStrictEqual(res.json, { ok: true });
  assert.ok(llamadas.includes('usuario:user-1'));
  assert.ok(lineas.some((l) => l.includes('customer de Polar')));
});

test('no loguea la contrasena ni en exito ni en fallo', async () => {
  suscripciones = ['sub-1'];
  const lineas = await conLogsCapturados(async () => {
    await eliminar({ password: PASSWORD });
    fallaRevocar = Object.assign(new Error('Polar 500'), { status: 500 });
    await eliminar({ password: PASSWORD });
  });
  assert.ok(lineas.length > 0);
  assert.ok(lineas.every((l) => !l.includes(PASSWORD)));
});
