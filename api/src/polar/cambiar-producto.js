'use strict';

const { polarFetch } = require('./cliente');

// Cambia el producto de la suscripcion SIN cobro ni reembolso: Polar lo aplica
// en la proxima renovacion (proration_behavior 'next_period', doc oficial de
// PATCH /v1/subscriptions/{id}) y lo expone en pending_update hasta entonces.
function cambiarProducto(polarSubscriptionId, productId) {
  return polarFetch(`/subscriptions/${polarSubscriptionId}`, {
    method: 'PATCH',
    body: { product_id: productId, proration_behavior: 'next_period' },
  });
}

module.exports = { cambiarProducto };
