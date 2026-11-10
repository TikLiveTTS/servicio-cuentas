'use strict';

const { query } = require('../db');

// Guarda el hash ya calculado (ver auth/hash-password.js) de un usuario.
async function actualizarPassword(userId, passwordHash) {
  await query(`UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`, [userId, passwordHash]);
}

module.exports = { actualizarPassword };
