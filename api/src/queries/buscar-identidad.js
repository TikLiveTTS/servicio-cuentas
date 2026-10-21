'use strict';

const { query } = require('../db');

// Busca que usuario tiene vinculada una identidad externa dada (ej. un sub
// de Google). Independiente de cual usuario este logueado: se usa en login.
async function buscarIdentidad(provider, providerUserId) {
  const { rows } = await query(
    `SELECT user_id, email FROM auth_identities WHERE provider = $1 AND provider_user_id = $2`,
    [provider, providerUserId]
  );
  return rows[0] || null;
}

module.exports = { buscarIdentidad };
