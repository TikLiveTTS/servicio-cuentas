'use strict';

const { query } = require('../db');

// true si nadie mas tiene ese nombre (case-insensitive). Vacio = "disponible"
// de cara a esta funcion; el endpoint es el que exige no-vacio antes de llamarla.
async function nicknameDisponible(nombre) {
  const limpio = String(nombre || '').trim();
  if (!limpio) return true;
  const { rows } = await query(
    `SELECT 1 FROM users WHERE lower(nombre) = lower($1) LIMIT 1`,
    [limpio]
  );
  return rows.length === 0;
}

module.exports = { nicknameDisponible };
