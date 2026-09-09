'use strict';

// Cancelar/reanudar al fin del periodo (reversible mientras no llegue esa
// fecha) — la misma llamada a Polar con el booleano invertido. La unica
// accion de auto-servicio que Polar garantiza en su Customer Portal. La
// hacemos directo por API en vez de armar un portal hosteado: ya tenemos el
// polar_subscription_id guardado, no hace falta nada mas.
const { polarFetch } = require('./cliente');

function setCancelAtPeriodEnd(polarSubscriptionId, cancelAtPeriodEnd) {
  return polarFetch(`/subscriptions/${polarSubscriptionId}`, {
    method: 'PATCH',
    body: { cancel_at_period_end: cancelAtPeriodEnd },
  });
}

const cancelarSuscripcion = (id) => setCancelAtPeriodEnd(id, true);
const reanudarSuscripcion = (id) => setCancelAtPeriodEnd(id, false);

module.exports = { cancelarSuscripcion, reanudarSuscripcion };
