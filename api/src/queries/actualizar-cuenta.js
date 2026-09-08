'use strict';

const { query } = require('../db');

// Solo nombre. Cambio de email/password es un flujo aparte (re-verificación),
// fuera de alcance de esta fase.
async function actualizarCuenta(userId, { nombre }) {
  const { rows } = await query(
    `UPDATE users SET nombre = $2, updated_at = now()
     WHERE id = $1
     RETURNING id, email, nombre`,
    [userId, String(nombre || '').trim()]
  );
  return rows[0] || null;
}

module.exports = { actualizarCuenta };
