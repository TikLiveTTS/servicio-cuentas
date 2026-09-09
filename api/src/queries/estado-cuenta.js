'use strict';

const { query } = require('../db');
const { suscripcionActiva } = require('./suscripcion-activa');

// Estado completo de la cuenta para /api/session y /api/entitlements.
//
// Plan efectivo:
//   'pro'  si hay una subscription del user con
//          status IN ('active','canceled') AND current_period_end > now()
//          (canceled sigue dando acceso hasta fin de período — así funciona Polar)
//   'free' en cualquier otro caso
async function estadoCuenta(userId) {
  const { rows: uRows } = await query(
    `SELECT id, email, nombre FROM users WHERE id = $1`,
    [userId]
  );
  const user = uRows[0];
  if (!user) return null;

  const sub = await suscripcionActiva(userId);
  const plan = sub ? 'pro' : 'free';

  const { rows: eRows } = await query(
    `SELECT feature_id FROM entitlements WHERE plan_id = $1`,
    [plan]
  );

  return {
    user: { id: user.id, email: user.email, nombre: user.nombre },
    plan,
    entitlements: eRows.map((r) => r.feature_id),
    subscription: sub
      ? {
          status: sub.status,
          currentPeriodEnd: sub.current_period_end,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        }
      : null,
  };
}

module.exports = { estadoCuenta };
