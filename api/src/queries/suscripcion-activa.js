'use strict';

const { query } = require('../db');

// Misma regla de "plan efectivo" que estado-cuenta.js: la suscripcion que le
// da Pro al usuario ahora mismo (si la hay). Compartida porque cancelar
// necesita el mismo dato (el polar_subscription_id de esa fila).
async function suscripcionActiva(userId) {
  const { rows } = await query(
    `SELECT id, polar_subscription_id, status, cancel_at_period_end, current_period_end
       FROM subscriptions
      WHERE user_id = $1
        AND status IN ('active','canceled')
        AND current_period_end IS NOT NULL
        AND current_period_end > now()
      ORDER BY current_period_end DESC
      LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

module.exports = { suscripcionActiva };
