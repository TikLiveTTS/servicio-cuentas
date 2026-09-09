'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../middleware/require-auth');
const { fail, wrap } = require('../lib/errores');
const { suscripcionActiva } = require('../queries/suscripcion-activa');
const { cancelarSuscripcion, reanudarSuscripcion } = require('../polar/cancelar-suscripcion');

const router = express.Router();

// Cancelar y reanudar son la misma operacion con el booleano invertido:
// buscar la suscripcion activa, pegarle a Polar, reflejar el resultado local
// sin esperar el webhook. cancelAtPeriodEnd es el valor que YA queremos (si
// coincide con el actual, no hay nada que hacer -> éxito de una).
async function setCancelAtPeriodEnd(req, res, { cancelAtPeriodEnd, accion, polarFn, sinCambiosKey }) {
  const sub = await suscripcionActiva(req.userId);
  if (!sub || !sub.polar_subscription_id) {
    return fail(res, 404, 'errors.noActiveSubscription', `No hay suscripcion activa para ${accion}`);
  }
  if (sub.cancel_at_period_end === cancelAtPeriodEnd) {
    return res.json({ ok: true, [sinCambiosKey]: true });
  }

  try {
    await polarFn(sub.polar_subscription_id);
  } catch (err) {
    if (err.code === 'polar_no_configurado') {
      return fail(res, 501, 'errors.notImplemented', `${accion} no configurada`);
    }
    // 4xx de Polar (ej. "AlreadyCanceledSubscription") no es un fallo de red,
    // es Polar diciendo que el estado que queriamos ya esta -> exito, no 502.
    if (err.status && err.status < 500) {
      await query(`UPDATE subscriptions SET cancel_at_period_end = $2, updated_at = now() WHERE id = $1`, [sub.id, cancelAtPeriodEnd]);
      return res.json({ ok: true, [sinCambiosKey]: true });
    }
    console.error(`[subscription] ${accion} fallo:`, err.message);
    return fail(res, 502, 'errors.polarUnavailable', `No se pudo ${accion} la suscripcion`);
  }

  // Optimista: no esperamos el webhook de Polar para que /api/session ya
  // refleje el cambio apenas el usuario vuelve a preguntar. El webhook
  // subscription.updated confirma lo mismo despues (idempotente).
  await query(`UPDATE subscriptions SET cancel_at_period_end = $2, updated_at = now() WHERE id = $1`, [sub.id, cancelAtPeriodEnd]);
  res.json({ ok: true });
}

// Cancela al fin del periodo pagado (sigue dando Pro hasta current_period_end,
// reversible via este mismo /resume mientras no llegue esa fecha).
router.post('/subscription/cancel', requireAuth, wrap((req, res) => setCancelAtPeriodEnd(req, res, {
  cancelAtPeriodEnd: true, accion: 'cancelar', polarFn: cancelarSuscripcion, sinCambiosKey: 'alreadyCanceled',
})));

// Deshace una cancelacion pendiente mientras la suscripcion sigue vigente.
router.post('/subscription/resume', requireAuth, wrap((req, res) => setCancelAtPeriodEnd(req, res, {
  cancelAtPeriodEnd: false, accion: 'reanudar', polarFn: reanudarSuscripcion, sinCambiosKey: 'alreadyActive',
})));

module.exports = router;
