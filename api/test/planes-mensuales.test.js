'use strict';

// Planes mensuales: product_id -> plan/intervalo, checkout por intervalo y
// change-interval. Sin red ni DB: se stubbean queries y Polar.

const { test } = require('node:test');
const assert = require('node:assert');

process.env.POSTGRES_URL = process.env.POSTGRES_URL || 'postgresql://u:p@localhost:5432/x';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'x'.repeat(32);
process.env.POLAR_API_KEY = 'polar_test_key';
process.env.POLAR_PRODUCT_ID_PRO_ANUAL = 'pro-anual';
process.env.POLAR_PRODUCT_ID_PRO_MENSUAL = 'pro-mensual';
process.env.POLAR_PRODUCT_ID_SIN_PROMOS = 'sin-promos-anual';
process.env.POLAR_PRODUCT_ID_SIN_PROMOS_MENSUAL = 'sin-promos-mensual';

const checkoutsCreados = [];
const cambiosProducto = [];
const updatesLocales = [];
let suscripcion = null;

function stub(mod, exp) {
  const p = require.resolve(mod);
  require.cache[p] = { id: p, filename: p, loaded: true, exports: exp };
}
stub('../src/middleware/require-auth', { requireAuth: (req, res, next) => { req.userId = 'user-1'; next(); } });
stub('../src/queries/buscar-usuario-por-id', { buscarUsuarioPorId: async () => ({ id: 'user-1', email: 'a@b.co' }) });
stub('../src/polar/crear-checkout', {
  crearCheckout: async (a) => { checkoutsCreados.push(a); return { url: 'https://polar.test/c' }; },
});
stub('../src/queries/suscripcion-activa', { suscripcionActiva: async () => suscripcion });
stub('../src/polar/cambiar-producto', {
  cambiarProducto: async (id, productId) => { cambiosProducto.push({ id, productId }); },
});
stub('../src/db', { query: async (sql, params) => { updatesLocales.push(params); return { rows: [] }; } });

const express = require('express');
const { resolverPlanId } = require('../src/polar/resolver-plan-id');
const { resolverIntervalo } = require('../src/polar/resolver-intervalo');
const { camposSuscripcion } = require('../src/polar/campos-suscripcion');

async function post(router, path, body) {
  const app = express();
  app.use(express.json());
  app.use('/api', router);
  const server = app.listen(0);
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: await res.json() };
  } finally {
    server.close();
  }
}
const checkout = (body) => post(require('../src/routes/checkout'), '/checkout', body);
const cambiarIntervalo = (body) => post(require('../src/routes/cambiar-intervalo'), '/subscription/change-interval', body);

test('los 4 product_id resuelven a su plan; Sin Promos mensual NO escala a pro', () => {
  assert.equal(resolverPlanId('pro-anual'), 'pro');
  assert.equal(resolverPlanId('pro-mensual'), 'pro');
  assert.equal(resolverPlanId('sin-promos-anual'), 'sin-promos');
  assert.equal(resolverPlanId('sin-promos-mensual'), 'sin-promos');
});

test('product_id desconocido o ausente resuelve a pro, sin intervalo', () => {
  assert.equal(resolverPlanId('otro'), 'pro');
  assert.equal(resolverPlanId(undefined), 'pro');
  assert.equal(resolverIntervalo('otro'), null);
  assert.equal(resolverIntervalo(undefined), null);
});

test('camposSuscripcion: intervalo del producto y siguiente_intervalo desde pending_update', () => {
  const base = { id: 's1', status: 'active', cancel_at_period_end: false, current_period_end: '2027-10-01T00:00:00Z' };
  const mensual = camposSuscripcion({ ...base, product_id: 'sin-promos-mensual' });
  assert.equal(mensual.planId, 'sin-promos');
  assert.equal(mensual.intervalo, 'month');
  assert.equal(mensual.siguienteIntervalo, null);

  const conCambio = camposSuscripcion({
    ...base, product_id: 'pro-anual', recurring_interval: 'year',
    pending_update: { product_id: 'pro-mensual', applies_at: '2027-10-01T00:00:00Z' },
  });
  assert.equal(conCambio.intervalo, 'year');
  assert.equal(conCambio.siguienteIntervalo, 'month');
});

test('checkout: intervalo month usa el producto mensual del plan', async () => {
  checkoutsCreados.length = 0;
  const res = await checkout({ plan: 'sin-promos', intervalo: 'month' });
  assert.equal(res.status, 200);
  assert.equal(checkoutsCreados[0].productId, 'sin-promos-mensual');
});

test('checkout: sin intervalo es anual (compat builds viejos)', async () => {
  checkoutsCreados.length = 0;
  const res = await checkout({ plan: 'pro' });
  assert.equal(res.status, 200);
  assert.equal(checkoutsCreados[0].productId, 'pro-anual');
});

test('checkout: intervalo invalido -> 400 errors.invalidBody', async () => {
  const res = await checkout({ plan: 'pro', intervalo: 'week' });
  assert.equal(res.status, 400);
  assert.equal(res.json.errorKey, 'errors.invalidBody');
});

test('change-interval: anual -> mensual programa el producto mensual y devuelve appliesAt', async () => {
  cambiosProducto.length = 0;
  updatesLocales.length = 0;
  suscripcion = {
    id: 'row-1', plan_id: 'pro', polar_subscription_id: 'sub-1', intervalo: 'year',
    current_period_end: '2027-10-01T00:00:00.000Z',
  };
  const res = await cambiarIntervalo({ intervalo: 'month' });
  assert.equal(res.status, 200);
  assert.deepEqual(res.json, { ok: true, appliesAt: '2027-10-01T00:00:00.000Z' });
  assert.deepEqual(cambiosProducto, [{ id: 'sub-1', productId: 'pro-mensual' }]);
  assert.deepEqual(updatesLocales[0], ['row-1', 'month']);
});

test('change-interval: pedir el intervalo actual deshace el cambio pendiente', async () => {
  updatesLocales.length = 0;
  suscripcion = {
    id: 'row-1', plan_id: 'pro', polar_subscription_id: 'sub-1', intervalo: 'year',
    current_period_end: '2027-10-01T00:00:00.000Z',
  };
  await cambiarIntervalo({ intervalo: 'year' });
  assert.deepEqual(updatesLocales[0], ['row-1', null]);
});

test('change-interval: intervalo invalido -> 400; sin suscripcion -> 404', async () => {
  assert.equal((await cambiarIntervalo({ intervalo: 'week' })).status, 400);
  suscripcion = null;
  assert.equal((await cambiarIntervalo({ intervalo: 'month' })).status, 404);
});
