'use strict';

const { query } = require('../db');

async function desvincularPlataforma(userId, plataforma) {
  const { rowCount } = await query(
    `DELETE FROM plataformas_vinculadas WHERE user_id = $1 AND plataforma = $2`,
    [userId, plataforma]
  );
  return rowCount > 0;
}

module.exports = { desvincularPlataforma };
