'use strict';

const { query } = require('../db');

// Mismo patron que desvincular-plataforma.js, pero para auth_identities
// (login con Google) en vez de plataformas_vinculadas (Twitch/Kick).
async function desvincularIdentidad(userId, provider) {
  const { rowCount } = await query(
    `DELETE FROM auth_identities WHERE user_id = $1 AND provider = $2`,
    [userId, provider]
  );
  return rowCount > 0;
}

module.exports = { desvincularIdentidad };
