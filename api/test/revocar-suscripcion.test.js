'use strict';

// revocarSuscripcion: 403/404 = ya revocada (se ignora); 409 y el resto se
// propagan (el 409 lo maneja eliminar-cuenta con el fallback). Sin red.

const { test } = require('node:test');
const assert = require('node:assert');

let respuestaPolar;
const p = require.resolve('../src/polar/cliente');
require.cache[p] = { id: p, filename: p, loaded: true, exports: { polarFetch: async () => { if (respuestaPolar) throw respuestaPolar; } } };

const { revocarSuscripcion } = require('../src/polar/revocar-suscripcion');

const errorPolar = (status) => Object.assign(new Error(`Polar ${status}`), { status });

for (const status of [403, 404]) {
  test(`${status} al revocar se trata como ya revocada`, async () => {
    respuestaPolar = errorPolar(status);
    await revocarSuscripcion('sub-1');
  });
}

test('409 (SubscriptionLocked) se propaga para que actue el fallback', async () => {
  respuestaPolar = errorPolar(409);
  await assert.rejects(revocarSuscripcion('sub-1'), { status: 409 });
});
