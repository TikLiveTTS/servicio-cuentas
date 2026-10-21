'use strict';

const { query } = require('../db');

// Que plataformas (Twitch/Kick) tiene vinculadas un usuario, para el perfil.
async function listarPlataformas(userId) {
  const { rows } = await query(
    `SELECT plataforma, plataforma_username, created_at
     FROM plataformas_vinculadas WHERE user_id = $1 ORDER BY created_at`,
    [userId]
  );
  return rows;
}

module.exports = { listarPlataformas };
