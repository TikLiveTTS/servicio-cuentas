'use strict';

// Cancelar-al-fin-de-periodo (reversible hasta esa fecha) — la unica accion
// de auto-servicio que Polar garantiza en su Customer Portal. La hacemos
// directo por API en vez de armar un portal hosteado: ya tenemos el
// polar_subscription_id guardado, no hace falta nada mas.
const { polarFetch } = require('./cliente');

async function cancelarSuscripcion(polarSubscriptionId) {
  return polarFetch(`/subscriptions/${polarSubscriptionId}`, {
    method: 'PATCH',
    body: { cancel_at_period_end: true },
  });
}

module.exports = { cancelarSuscripcion };
