'use strict';

const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../middleware/require-auth');
const { fail, wrap } = require('../lib/errores');
const { suscripcionActiva } = require('../queries/suscripcion-activa');
const { cambiarProducto } = require('../polar/cambiar-producto');
const { resolverProductoId } = require('../polar/resolver-producto-id');
const { INTERVALOS } = require('../polar/catalogo-productos');

const router = express.Router();

// Programa el cambio mensual<->anual para la proxima renovacion: el periodo ya
// pagado se cumple completo. Pedir el intervalo actual deshace un cambio
// programado antes.
router.post('/subscription/change-interval', requireAuth, wrap(async (req, res) => {
  const intervalo = req.body && req.body.intervalo;
  if (!INTERVALOS.includes(intervalo)) return fail(res, 400, 'errors.invalidBody', 'Intervalo invalido');

  const sub = await suscripcionActiva(req.userId);
  if (!sub || !sub.polar_subscription_id) {
    return fail(res, 404, 'errors.noActiveSubscription', 'No hay suscripcion activa para cambiar de intervalo');
  }
  const productId = resolverProductoId(sub.plan_id, intervalo);
  if (!productId) return fail(res, 501, 'errors.notImplemented', 'Intervalo no configurado (Polar)');

  try {
    await cambiarProducto(sub.polar_subscription_id, productId);
  } catch (err) {
    if (err.code === 'polar_no_configurado') {
      return fail(res, 501, 'errors.notImplemented', 'Cambio de intervalo no configurado');
    }
    console.error('[subscription] cambiar intervalo fallo:', err.message);
    return fail(res, 502, 'errors.polarUnavailable', 'No se pudo cambiar el intervalo');
  }

  // Optimista, igual que cancelar/reanudar; el webhook subscription.updated confirma.
  const siguiente = intervalo === sub.intervalo ? null : intervalo;
  await query(`UPDATE subscriptions SET siguiente_intervalo = $2, updated_at = now() WHERE id = $1`, [sub.id, siguiente]);
  res.json({ ok: true, appliesAt: new Date(sub.current_period_end).toISOString() });
}));

module.exports = router;
