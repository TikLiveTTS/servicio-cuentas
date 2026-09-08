'use strict';

const { query } = require('../db');

async function buscarUsuarioPorId(id) {
  const { rows } = await query(
    `SELECT id, email, nombre FROM users WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

module.exports = { buscarUsuarioPorId };
