'use strict';

const { polarFetch } = require('./cliente');

// DELETE /v1/customers/external/{external_id}: external_id = users.id.
// anonymize=true pide a Polar borrar los datos personales del customer (GDPR).
// 404 = nunca llego a ser customer (no compro nada) -> nada que borrar.
async function eliminarCliente(externalId) {
  try {
    await polarFetch(`/customers/external/${encodeURIComponent(externalId)}?anonymize=true`, { method: 'DELETE' });
  } catch (err) {
    if (err.status === 404) return;
    throw err;
  }
}

module.exports = { eliminarCliente };
