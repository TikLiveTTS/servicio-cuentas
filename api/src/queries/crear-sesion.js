'use strict';

const { query } = require('../db');
const { generarToken } = require('../auth/generar-token');
const config = require('../config');

async function crearSesion(userId) {
  const token = generarToken();
  const expiresAt = new Date(Date.now() + config.sessionHours * 3600 * 1000);
  await query(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)`,
    [token, userId, expiresAt]
  );
  return { token, expiresAt };
}

module.exports = { crearSesion };
