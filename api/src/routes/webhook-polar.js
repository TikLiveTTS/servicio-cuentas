'use strict';

const express = require('express');
const { verificarFirma } = require('../polar/verificar-firma');
const { marcarEventoWebhook } = require('../queries/marcar-evento-webhook');
const { upsertSuscripcion } = require('../queries/upsert-suscripcion');
const { buscarUsuarioPorEmail } = require('../queries/buscar-usuario-por-email');

const router = express.Router();

// Eventos de suscripcion que nos interesan. 'subscription.updated' es catch-all
// (trae el estado completo); los otros son bordes explicitos.
const RELEVANTES = new Set([
  'subscription.created',
  'subscription.updated',
  'subscription.active',
  'subscription.canceled',
  'subscription.revoked',
  'subscription.uncanceled',
  'subscription.past_due',
]);

// Resuelve nuestro users.id desde el payload de suscripcion de Polar.
async function resolverUserId(sub) {
  const ext = sub.customer && (sub.customer.external_id || sub.customer.external_customer_id);
  if (ext) return ext;
  if (sub.metadata && sub.metadata.user_id) return sub.metadata.user_id;
  const email = sub.customer && sub.customer.email;
  if (email) {
    const u = await buscarUsuarioPorEmail(email);
    if (u) return u.id;
  }
  return null;
}

// express.raw: firma standardwebhooks necesita el cuerpo sin parsear.
router.post('/webhooks/polar', express.raw({ type: '*/*' }), async (req, res) => {
  let evento;
  try {
    evento = verificarFirma(req.body, req.headers);
  } catch (err) {
    if (err.code === 'polar_no_configurado') {
      return res.status(501).json({ error: 'Webhook no configurado', errorKey: 'errors.notImplemented' });
    }
    return res.status(403).json({ error: 'Firma invalida', errorKey: 'errors.invalidSignature' });
  }

  try {
    const nuevo = await marcarEventoWebhook(evento.id || evento.event_id, evento.type);
    if (!nuevo) return res.json({ received: true, duplicate: true });

    if (RELEVANTES.has(evento.type)) {
      const sub = evento.data;
      const userId = await resolverUserId(sub);
      if (!userId) {
        console.error(`[webhook-polar] ${evento.type}: sin userId resoluble (sub ${sub.id})`);
      } else {
        await upsertSuscripcion({
          userId,
          polarSubscriptionId: sub.id,
          status: sub.status,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          currentPeriodEnd: sub.current_period_end || sub.ends_at || null,
        });
        console.log(`[webhook-polar] ${evento.type} user=${userId} status=${sub.status}`);
      }
    }
    res.json({ received: true });
  } catch (err) {
    // 500 -> Polar reintenta.
    console.error('[webhook-polar] error procesando:', err.stack || err.message);
    res.status(500).json({ error: 'Error interno', errorKey: 'errors.internal' });
  }
});

module.exports = router;
