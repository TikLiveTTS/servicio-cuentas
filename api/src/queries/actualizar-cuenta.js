'use strict';

const { query } = require('../db');

// Solo nombre. Cambio de email/password es un flujo aparte (re-verificación),
// fuera de alcance de esta fase. Lanza con code 'nickname_taken' si el
// nickname ya lo tiene otro usuario (users_nombre_unico_idx).
async function actualizarCuenta(userId, { nombre }) {
  try {
    const { rows } = await query(
      `UPDATE users SET nombre = $2, updated_at = now()
       WHERE id = $1
       RETURNING id, email, nombre`,
      [userId, String(nombre || '').trim()]
    );
    return rows[0] || null;
  } catch (err) {
    if (err.code === '23505' && err.constraint === 'users_nombre_unico_idx') {
      const e = new Error('nickname ya tomado');
      e.code = 'nickname_taken';
      throw e;
    }
    throw err;
  }
}

module.exports = { actualizarCuenta };
