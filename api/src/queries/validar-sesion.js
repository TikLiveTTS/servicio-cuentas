'use strict';

const { query } = require('../db');

// Devuelve { user_id } si el token existe y no expiró; si no, null.
// Borrado perezoso de la fila expirada (además del barrido del job).
async function validarSesion(token) {
  const { rows } = await query(
    `SELECT user_id, expires_at FROM sessions WHERE token = $1`,
    [token]
  );
  const s = rows[0];
  if (!s) return null;
  if (new Date(s.expires_at).getTime() <= Date.now()) {
    await query(`DELETE FROM sessions WHERE token = $1`, [token]).catch(() => {});
    return null;
  }
  return { user_id: s.user_id };
}

module.exports = { validarSesion };
