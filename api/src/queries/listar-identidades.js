'use strict';

const { query } = require('../db');

// Que proveedores tiene vinculados un usuario, para el perfil (que botones
// mostrar como "vincular" vs "ya vinculado").
async function listarIdentidades(userId) {
  const { rows } = await query(
    `SELECT provider, email, created_at FROM auth_identities WHERE user_id = $1 ORDER BY created_at`,
    [userId]
  );
  return rows;
}

module.exports = { listarIdentidades };
