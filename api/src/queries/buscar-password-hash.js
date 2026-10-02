'use strict';

const { query } = require('../db');

async function buscarPasswordHash(userId) {
  const { rows } = await query(`SELECT password_hash FROM users WHERE id = $1`, [userId]);
  return rows[0] ? rows[0].password_hash : null;
}

module.exports = { buscarPasswordHash };
