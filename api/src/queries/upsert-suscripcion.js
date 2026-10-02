'use strict';

const { query } = require('../db');

// Refleja el estado de una suscripción de Polar en nuestra tabla. Idempotente
// por polar_subscription_id. Lo usa el handler de webhook (agente 03) y el job
// de reconciliación. Si el usuario ya no existe (cuenta eliminada: el webhook
// subscription.revoked llega despues del borrado) no inserta nada.
async function upsertSuscripcion({
  userId,
  polarSubscriptionId,
  status,
  cancelAtPeriodEnd,
  currentPeriodEnd,
  planId = 'pro',
  intervalo = null,
  siguienteIntervalo = null,
}) {
  const { rows } = await query(
    `INSERT INTO subscriptions
       (user_id, plan_id, status, polar_subscription_id, cancel_at_period_end, current_period_end, intervalo, siguiente_intervalo)
     SELECT $1::uuid, $2::text, $3::text, $4::text, $5::boolean, $6::timestamptz, $7::text, $8::text
      WHERE EXISTS (SELECT 1 FROM users WHERE id = $1)
     ON CONFLICT (polar_subscription_id) DO UPDATE SET
       status = EXCLUDED.status,
       cancel_at_period_end = EXCLUDED.cancel_at_period_end,
       current_period_end = EXCLUDED.current_period_end,
       intervalo = EXCLUDED.intervalo,
       siguiente_intervalo = EXCLUDED.siguiente_intervalo,
       updated_at = now()
     RETURNING id, status`,
    [userId, planId, status, polarSubscriptionId, !!cancelAtPeriodEnd, currentPeriodEnd || null, intervalo, siguienteIntervalo]
  );
  return rows[0];
}

module.exports = { upsertSuscripcion };
