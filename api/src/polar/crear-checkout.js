'use strict';

// POST /v1/checkouts. external_customer_id = nuestro users.id -> Polar lo
// devuelve como customer.external_id en todos los webhooks (reconciliacion
// sin tabla de correspondencia). Ver 01-hallazgos.md seccion 2.

const { polarFetch } = require('./cliente');

async function crearCheckout({ productId, customerEmail, externalCustomerId, successUrl }) {
  const checkout = await polarFetch('/checkouts', {
    method: 'POST',
    body: {
      products: [productId],
      customer_email: customerEmail,
      external_customer_id: externalCustomerId,
      success_url: successUrl,
      metadata: { user_id: externalCustomerId },
    },
  });
  return { url: checkout.url, id: checkout.id };
}

module.exports = { crearCheckout };
