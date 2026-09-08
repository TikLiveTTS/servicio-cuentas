'use strict';

// Job in-proceso (patron telemetria-tts/jobs.js): setInterval con .unref(),
// primer pase al arrancar. Dos tareas:
//  1. barrido de sesiones expiradas (siempre)
//  2. reconciliacion con Polar de las suscripciones vivas (si Polar configurado)
//     — red de seguridad ante un webhook perdido.

const config = require('../config');
const { query } = require('../db');
const { upsertSuscripcion } = require('../queries/upsert-suscripcion');
const { polarFetch } = require('../polar/cliente');

async function purgarSesiones() {
  const { rowCount } = await query('DELETE FROM sessions WHERE expires_at < now()');
  if (rowCount > 0) console.log(`[reconciliar] ${rowCount} sesiones expiradas purgadas`);
}

async function reconciliarPolar() {
  if (!config.polarApiKey) return;
  const { rows } = await query(
    `SELECT id, user_id, polar_subscription_id, status, current_period_end
       FROM subscriptions
      WHERE polar_subscription_id IS NOT NULL
        AND status IN ('active','canceled','past_due')`
  );
  for (const local of rows) {
    let remoto;
    try {
      remoto = await polarFetch(`/subscriptions/${local.polar_subscription_id}`);
    } catch (err) {
      console.error(`[reconciliar] Polar ${local.polar_subscription_id}: ${err.message}`);
      continue;
    }
    const mismaFecha =
      String(local.current_period_end && new Date(local.current_period_end).toISOString()) ===
      String(remoto.current_period_end && new Date(remoto.current_period_end).toISOString());
    if (remoto.status !== local.status || !mismaFecha) {
      await upsertSuscripcion({
        userId: local.user_id,
        polarSubscriptionId: local.polar_subscription_id,
        status: remoto.status,
        cancelAtPeriodEnd: remoto.cancel_at_period_end,
        currentPeriodEnd: remoto.current_period_end || remoto.ends_at || null,
      });
      console.log(
        `[reconciliar] divergencia sub=${local.polar_subscription_id} ` +
        `local=${local.status} remoto=${remoto.status} -> corregido`
      );
    }
  }
}

async function reconciliar() {
  await purgarSesiones();
  await reconciliarPolar();
}

function start() {
  const tick = () => reconciliar().catch((err) => console.error('[reconciliar] fallo:', err.message));
  tick();
  const timer = setInterval(tick, config.reconcileEveryHours * 3600 * 1000);
  if (timer.unref) timer.unref();
  return timer;
}

module.exports = { start, reconciliar };
