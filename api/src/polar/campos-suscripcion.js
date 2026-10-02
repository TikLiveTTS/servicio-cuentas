'use strict';

const { resolverPlanId } = require('./resolver-plan-id');
const { resolverIntervalo } = require('./resolver-intervalo');

// Suscripcion de Polar (webhook o GET /subscriptions/{id}) -> campos que
// espera upsertSuscripcion. pending_update es el cambio de producto programado.
function camposSuscripcion(sub) {
  const productoPendiente = sub.pending_update && sub.pending_update.product_id;
  return {
    polarSubscriptionId: sub.id,
    status: sub.status,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    currentPeriodEnd: sub.current_period_end || sub.ends_at || null,
    planId: resolverPlanId(sub.product_id),
    intervalo: sub.recurring_interval || resolverIntervalo(sub.product_id),
    siguienteIntervalo: productoPendiente ? resolverIntervalo(productoPendiente) : null,
  };
}

module.exports = { camposSuscripcion };
