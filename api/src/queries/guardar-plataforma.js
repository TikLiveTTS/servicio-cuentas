'use strict';

const { query } = require('../db');

// Guarda la plataforma vinculada de un usuario (los tokens ya vienen
// cifrados, ver lib/cifrado.js — esta funcion no cifra nada, solo persiste).
// Lanza con code 'plataforma_tomada' si esa cuenta externa ya esta vinculada
// a OTRO usuario, o 'ya_vinculado' si el mismo usuario ya tiene esa
// plataforma vinculada (coincida o no la cuenta -- eso lo distingue el
// llamador antes de insertar).
async function guardarPlataforma({
  userId,
  plataforma,
  plataformaUserId,
  plataformaUsername,
  accessTokenCifrado,
  refreshTokenCifrado,
  expiresAt,
  scopes,
}) {
  try {
    const { rows } = await query(
      `INSERT INTO plataformas_vinculadas
         (user_id, plataforma, plataforma_user_id, plataforma_username,
          access_token_cifrado, refresh_token_cifrado, expires_at, scopes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [userId, plataforma, plataformaUserId, plataformaUsername,
        accessTokenCifrado, refreshTokenCifrado, expiresAt, scopes]
    );
    return rows[0];
  } catch (err) {
    if (err.code === '23505' && err.constraint === 'plataformas_vinculadas_plataforma_plataforma_user_id_key') {
      const e = new Error('esa cuenta ya esta vinculada a otro usuario');
      e.code = 'plataforma_tomada';
      throw e;
    }
    if (err.code === '23505' && err.constraint === 'plataformas_vinculadas_user_id_plataforma_key') {
      const e = new Error('el usuario ya tiene esa plataforma vinculada');
      e.code = 'ya_vinculado';
      throw e;
    }
    throw err;
  }
}

module.exports = { guardarPlataforma };
