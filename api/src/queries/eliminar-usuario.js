'use strict';

const { query } = require('../db');

// Un solo DELETE es atomico en Postgres: sessions y subscriptions caen por
// ON DELETE CASCADE dentro de la misma sentencia, o no cae nada.
async function eliminarUsuario(userId) {
  await query(`DELETE FROM users WHERE id = $1`, [userId]);
}

module.exports = { eliminarUsuario };
