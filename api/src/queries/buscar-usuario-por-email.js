'use strict';

const { query } = require('../db');

async function buscarUsuarioPorEmail(email) {
  const { rows } = await query(
    `SELECT id, email, password_hash, nombre FROM users WHERE email = $1`,
    [String(email || '').trim().toLowerCase()]
  );
  return rows[0] || null;
}

module.exports = { buscarUsuarioPorEmail };
