'use strict';

const { query } = require('../db');

async function invalidarSesion(token) {
  await query(`DELETE FROM sessions WHERE token = $1`, [token]);
}

// Cierra todas las sesiones de un usuario (cambio de plan, sospecha de robo).
async function invalidarSesionesDeUsuario(userId) {
  await query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
}

module.exports = { invalidarSesion, invalidarSesionesDeUsuario };
