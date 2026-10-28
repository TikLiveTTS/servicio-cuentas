'use strict';

const { query } = require('../db');

// Usado para bloquear desvincular Google si seria la unica forma de login
// que le queda al usuario (ver DELETE /account/link/google).
async function tienePassword(userId) {
  const { rows } = await query(
    `SELECT (password_hash IS NOT NULL) AS has_password FROM users WHERE id = $1`,
    [userId]
  );
  return !!rows[0]?.has_password;
}

module.exports = { tienePassword };
