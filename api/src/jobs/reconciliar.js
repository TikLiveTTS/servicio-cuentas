'use strict';

// Job de reconciliacion in-proceso (patron telemetria-tts/jobs.js): setInterval
// con .unref(), primer pase al arrancar. Corrige divergencias entre nuestra
// tabla subscriptions y el estado real en Polar (por si se perdio un webhook).
//
// TODO(agente-03): implementar el cuerpo. Debe:
//   - SELECT las subscriptions con polar_subscription_id
//   - por cada una, GET /v1/subscriptions/{id} en Polar (polar/cliente.js)
//   - si el status / current_period_end difiere -> upsertSuscripcion(...) y
//     loguear 'cuentas.reconciliacion.divergencia'
//   - barrer sessions expiradas: DELETE FROM sessions WHERE expires_at < now()

const config = require('../config');
const { query } = require('../db');

async function reconciliar() {
  // Barrido de sesiones expiradas (esto si va desde ya).
  const { rowCount } = await query('DELETE FROM sessions WHERE expires_at < now()');
  if (rowCount > 0) console.log(`[reconciliar] ${rowCount} sesiones expiradas purgadas`);

  // TODO(agente-03): reconciliacion con Polar.
}

function start() {
  const tick = () => reconciliar().catch((err) => console.error('[reconciliar] fallo:', err.message));
  tick(); // primer pase al arrancar
  const timer = setInterval(tick, config.reconcileEveryHours * 3600 * 1000);
  if (timer.unref) timer.unref();
  return timer;
}

module.exports = { start, reconciliar };
