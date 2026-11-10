'use strict';

const { query } = require('../db');

async function invalidarSesion(token) {
  await query(`DELETE FROM sessions WHERE token = $1`, [token]);
}

// Cierra todas las sesiones de un usuario (cambio de plan, sospecha de robo).
async function invalidarSesionesDeUsuario(userId) {
  await query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
}

// Cierra todas las sesiones de un usuario MENOS la actual (cambio de contraseña
// estando logueado: quien la cambia sigue dentro, cualquier otro dispositivo o
// sesion robada queda fuera).
async function invalidarOtrasSesiones(userId, tokenActual) {
  await query(`DELETE FROM sessions WHERE user_id = $1 AND token <> $2`, [userId, tokenActual]);
}

module.exports = { invalidarSesion, invalidarSesionesDeUsuario, invalidarOtrasSesiones };
