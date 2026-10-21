'use strict';

const { query } = require('../db');

// La plataforma vinculada de un usuario ya conocido (vincular desde el
// perfil: saber si ya tiene esta plataforma y a que cuenta externa).
async function buscarPlataformaUsuario(userId, plataforma) {
  const { rows } = await query(
    `SELECT plataforma_user_id, plataforma_username FROM plataformas_vinculadas
     WHERE user_id = $1 AND plataforma = $2`,
    [userId, plataforma]
  );
  return rows[0] || null;
}

module.exports = { buscarPlataformaUsuario };
