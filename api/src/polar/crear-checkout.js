'use strict';

// TODO(agente-03): implementar contra POST /v1/checkouts.
//   body: { products: [productId], customer_email, external_customer_id,
//           success_url, metadata: { user_id } }
//   -> devuelve { url }
// Ver 01-hallazgos.md seccion 2 ("Checkout").

const { polarFetch } = require('./cliente');

async function crearCheckout({ productId, customerEmail, externalCustomerId, successUrl, metadata }) {
  const checkout = await polarFetch('/checkouts', {
    method: 'POST',
    body: {
      products: [productId],
      customer_email: customerEmail,
      external_customer_id: externalCustomerId,
      success_url: successUrl,
      metadata: metadata || {},
    },
  });
  return { url: checkout.url, id: checkout.id };
}

module.exports = { crearCheckout };
