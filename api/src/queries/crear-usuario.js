'use strict';

const { query } = require('../db');

// Inserta un usuario. Lanza con code 'email_taken' o 'nickname_taken' segun
// que constraint unico choco (users_nombre_unico_idx es el nickname).
async function crearUsuario({ email, passwordHash, nombre }) {
  try {
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, nombre)
       VALUES ($1, $2, $3)
       RETURNING id, email, nombre, created_at`,
      [email.trim().toLowerCase(), passwordHash, (nombre || '').trim()]
    );
    return rows[0];
  } catch (err) {
    if (err.code === '23505') {
      const e = new Error(err.constraint === 'users_nombre_unico_idx' ? 'nickname ya tomado' : 'email ya registrado');
      e.code = err.constraint === 'users_nombre_unico_idx' ? 'nickname_taken' : 'email_taken';
      throw e;
    }
    throw err;
  }
}

module.exports = { crearUsuario };
