'use strict';

const { query } = require('../db');

// La identidad de un proveedor dado para un usuario ya conocido (vincular
// desde el perfil, confirmar borrado de cuenta sin password).
async function buscarIdentidadUsuario(userId, provider) {
  const { rows } = await query(
    `SELECT provider_user_id, email FROM auth_identities WHERE user_id = $1 AND provider = $2`,
    [userId, provider]
  );
  return rows[0] || null;
}

module.exports = { buscarIdentidadUsuario };
