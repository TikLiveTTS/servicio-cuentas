'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../middleware/require-auth');
const { fail, wrap } = require('../lib/errores');
const { suscripcionActiva } = require('../queries/suscripcion-activa');
const { cancelarSuscripcion } = require('../polar/cancelar-suscripcion');

const router = express.Router();

// Cancela al fin del periodo pagado (sigue dando Pro hasta current_period_end,
// reversible via Polar hasta esa fecha). No hay endpoint de "deshacer" propio
// todavia -> lo maneja el usuario desde Polar si hace falta.
router.post('/subscription/cancel', requireAuth, wrap(async (req, res) => {
  const sub = await suscripcionActiva(req.userId);
  if (!sub || !sub.polar_subscription_id) {
    return fail(res, 404, 'errors.noActiveSubscription', 'No hay suscripcion activa para cancelar');
  }
  if (sub.cancel_at_period_end) {
    return res.json({ ok: true, alreadyCanceled: true });
  }

  try {
    await cancelarSuscripcion(sub.polar_subscription_id);
  } catch (err) {
    if (err.code === 'polar_no_configurado') {
      return fail(res, 501, 'errors.notImplemented', 'Cancelacion no configurada');
    }
    // 4xx de Polar (ej. "AlreadyCanceledSubscription") no es un fallo de red,
    // es Polar diciendo que el estado que queriamos ya esta -> exito, no 502.
    // Vista real: una carrera entre dos intentos del usuario devolvio esto.
    if (err.status && err.status < 500) {
      await query(`UPDATE subscriptions SET cancel_at_period_end = true, updated_at = now() WHERE id = $1`, [sub.id]);
      return res.json({ ok: true, alreadyCanceled: true });
    }
    console.error('[subscription] cancelar fallo:', err.message);
    return fail(res, 502, 'errors.polarUnavailable', 'No se pudo cancelar la suscripcion');
  }

  // Optimista: no esperamos el webhook de Polar para que /api/session ya
  // refleje "se cancela el <fecha>" apenas el usuario vuelve a preguntar.
  // El webhook subscription.updated confirma lo mismo despues (idempotente).
  await query(`UPDATE subscriptions SET cancel_at_period_end = true, updated_at = now() WHERE id = $1`, [sub.id]);

  res.json({ ok: true });
}));

module.exports = router;
