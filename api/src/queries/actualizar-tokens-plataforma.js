'use strict';

const { query } = require('../db');

async function actualizarTokensPlataforma({ userId, plataforma, accessTokenCifrado, refreshTokenCifrado, expiresAt }) {
  await query(
    `UPDATE plataformas_vinculadas
     SET access_token_cifrado = $3, refresh_token_cifrado = $4, expires_at = $5, updated_at = now()
     WHERE user_id = $1 AND plataforma = $2`,
    [userId, plataforma, accessTokenCifrado, refreshTokenCifrado, expiresAt]
  );
}

module.exports = { actualizarTokensPlataforma };
