'use strict';

const { query } = require('../db');

// A que user_id nuestro pertenece un canal externo (para enrutar un webhook
// de Twitch/Kick al usuario correcto).
async function buscarUsuarioPorPlataforma(plataforma, plataformaUserId) {
  const { rows } = await query(
    `SELECT user_id FROM plataformas_vinculadas WHERE plataforma = $1 AND plataforma_user_id = $2`,
    [plataforma, plataformaUserId]
  );
  return rows[0] ? rows[0].user_id : null;
}

module.exports = { buscarUsuarioPorPlataforma };
