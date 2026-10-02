'use strict';

const { polarFetch } = require('./cliente');

// DELETE /v1/subscriptions/{id}: cancela AL INSTANTE (revoke), sin esperar el
// fin del periodo. 403 = ya estaba revocada, 404 = no existe en Polar; en los
// dos casos el objetivo (que no cobre mas) ya se cumple.
async function revocarSuscripcion(polarSubscriptionId) {
  try {
    await polarFetch(`/subscriptions/${polarSubscriptionId}`, { method: 'DELETE' });
  } catch (err) {
    if (err.status === 403 || err.status === 404) return;
    throw err;
  }
}

module.exports = { revocarSuscripcion };
