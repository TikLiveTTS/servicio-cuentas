'use strict';

const { query } = require('../db');

// Tokens cifrados + vencimiento de la plataforma vinculada de un usuario
// (para renovar/usar el token, no para mostrar en el perfil).
async function buscarTokensPlataforma(userId, plataforma) {
  const { rows } = await query(
    `SELECT access_token_cifrado, refresh_token_cifrado, expires_at
     FROM plataformas_vinculadas WHERE user_id = $1 AND plataforma = $2`,
    [userId, plataforma]
  );
  return rows[0] || null;
}

module.exports = { buscarTokensPlataforma };
