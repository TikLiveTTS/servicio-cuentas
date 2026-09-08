'use strict';

const { query } = require('../db');

// Refleja el estado de una suscripción de Polar en nuestra tabla. Idempotente
// por polar_subscription_id. Lo usa el handler de webhook (agente 03) y el job
// de reconciliación.
async function upsertSuscripcion({
  userId,
  polarSubscriptionId,
  status,
  cancelAtPeriodEnd,
  currentPeriodEnd,
  planId = 'pro',
}) {
  const { rows } = await query(
    `INSERT INTO subscriptions
       (user_id, plan_id, status, polar_subscription_id, cancel_at_period_end, current_period_end)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (polar_subscription_id) DO UPDATE SET
       status = EXCLUDED.status,
       cancel_at_period_end = EXCLUDED.cancel_at_period_end,
       current_period_end = EXCLUDED.current_period_end,
       updated_at = now()
     RETURNING id, status`,
    [userId, planId, status, polarSubscriptionId, !!cancelAtPeriodEnd, currentPeriodEnd || null]
  );
  return rows[0];
}

module.exports = { upsertSuscripcion };
