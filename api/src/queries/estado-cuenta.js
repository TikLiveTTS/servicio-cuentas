'use strict';

const { query } = require('../db');
const { suscripcionActiva } = require('./suscripcion-activa');
const { urlImagen } = require('../cloudinary/url-imagen');

// Estado completo de la cuenta para /api/session y /api/entitlements.
//
// Plan efectivo:
//   sub.plan_id  si hay una subscription del user con
//                status IN ('active','canceled') AND current_period_end > now()
//                (canceled sigue dando acceso hasta fin de período — así funciona Polar)
//   'free'       en cualquier otro caso
async function estadoCuenta(userId) {
  const { rows: uRows } = await query(
    `SELECT id, email, nombre, (password_hash IS NOT NULL) AS has_password,
            avatar_actualizado_at, banner_actualizado_at, rol_canal
     FROM users WHERE id = $1`,
    [userId]
  );
  const user = uRows[0];
  if (!user) return null;

  const sub = await suscripcionActiva(userId);
  const plan = sub ? sub.plan_id : 'free';

  const { rows: eRows } = await query(
    `SELECT feature_id FROM entitlements WHERE plan_id = $1`,
    [plan]
  );

  return {
    user: {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      hasPassword: user.has_password,
      avatarUrl: urlImagen('avatares', user.id, user.avatar_actualizado_at),
      bannerUrl: urlImagen('banners', user.id, user.banner_actualizado_at),
      rolCanal: user.rol_canal,
    },
    plan,
    entitlements: eRows.map((r) => r.feature_id),
    subscription: sub
      ? {
          status: sub.status,
          currentPeriodEnd: sub.current_period_end,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          interval: sub.intervalo,
          nextInterval: sub.siguiente_intervalo,
        }
      : null,
  };
}

module.exports = { estadoCuenta };
