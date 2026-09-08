'use strict';

const express = require('express');

const router = express.Router();

// La verificacion de firma (standardwebhooks) necesita el cuerpo RAW, sin
// parsear. Por eso este router usa express.raw() y NO el express.json() global.
//
// TODO(agente-03): implementar. Debe:
//  - polar/verificar-firma.js(req.body /* Buffer */, req.headers) -> 403 si invalida
//  - parsear el JSON ya verificado
//  - marcarEventoWebhook(evento.id, evento.type): si devuelve false -> 200 sin re-procesar
//  - switch (evento.type):
//      'subscription.updated' | 'subscription.active' | 'subscription.canceled'
//      | 'subscription.revoked'  -> upsertSuscripcion({
//           userId: data.customer.external_id,
//           polarSubscriptionId: data.id,
//           status: data.status,
//           cancelAtPeriodEnd: data.cancel_at_period_end,
//           currentPeriodEnd: data.current_period_end,
//        })
//  - responder 200 { received: true }
//  - excepcion inesperada -> 500 (Polar reintenta)
router.post('/webhooks/polar', express.raw({ type: '*/*' }), (req, res) => {
  res.status(501).json({ error: 'No implementado', errorKey: 'errors.notImplemented' });
});

module.exports = router;
