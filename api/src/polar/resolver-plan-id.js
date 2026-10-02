'use strict';

const { catalogoProductos } = require('./catalogo-productos');

// Mapea el product_id que manda Polar (webhook/reconciliacion) a nuestro
// plan_id local. Default 'pro': preserva el comportamiento previo a que
// existiera un segundo plan (y cubre eventos de test sin product_id). Por eso
// todo producto no-pro DEBE estar en el catalogo, o se escalaria a 'pro'.
function resolverPlanId(productId) {
  const producto = catalogoProductos().find((p) => p.id === productId);
  return producto ? producto.plan : 'pro';
}

module.exports = { resolverPlanId };
