'use strict';

const { query } = require('../db');

// Ids de Polar de toda suscripcion que todavia puede cobrar o dar acceso
// (cualquier estado menos revoked). Distinta de suscripcionActiva: esa solo
// devuelve la que da Pro hoy; para borrar la cuenta hay que revocarlas todas.
async function suscripcionesPolarVigentes(userId) {
  const { rows } = await query(
    `SELECT polar_subscription_id FROM subscriptions
      WHERE user_id = $1 AND polar_subscription_id IS NOT NULL AND status <> 'revoked'`,
    [userId]
  );
  return rows.map((r) => r.polar_subscription_id);
}

module.exports = { suscripcionesPolarVigentes };
