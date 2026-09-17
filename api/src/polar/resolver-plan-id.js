'use strict';

const config = require('../config');

// Mapea el product_id que manda Polar (webhook/reconciliacion) a nuestro
// plan_id local. Unico lugar con esta tabla -- agregar un plan nuevo es sumar
// una linea aca (+ su env var en config.js), sin tocar webhook-polar.js ni
// reconciliar.js. Default 'pro': preserva el comportamiento previo a que
// existiera un segundo plan (y cubre eventos de test sin product_id).
function resolverPlanId(productId) {
  if (productId && productId === config.polarProductIdSinPromos) return 'sin-promos';
  return 'pro';
}

module.exports = { resolverPlanId };
