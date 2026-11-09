'use strict';

const { query } = require('../db');

// A que user_id nuestros pertenece un canal externo (para enrutar un webhook
// de Twitch/Kick). Un mismo canal puede estar vinculado a VARIAS cuentas
// nuestras (migracion 014), asi que devuelve todas; [] si no hay ninguna.
async function buscarUsuariosPorPlataforma(plataforma, plataformaUserId) {
  const { rows } = await query(
    `SELECT user_id FROM plataformas_vinculadas WHERE plataforma = $1 AND plataforma_user_id = $2`,
    [plataforma, plataformaUserId]
  );
  return rows.map((r) => r.user_id);
}

module.exports = { buscarUsuariosPorPlataforma };
