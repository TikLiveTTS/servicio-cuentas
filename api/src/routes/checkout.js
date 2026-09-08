'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/require-auth');

const router = express.Router();

// TODO(agente-03): implementar el checkout de Polar. Debe:
//  - validar body { plan: 'pro' }
//  - buscar el email del usuario (queries/buscar-usuario-por-id.js)
//  - polar/crear-checkout.js con:
//      product_id          = config.polarProductIdProAnual
//      external_customer_id = req.userId
//      customer_email       = user.email
//      success_url          = `${config.publicUrl}/checkout/ok?checkout_id={CHECKOUT_ID}`
//  - responder 200 { url }
//  - errores de Polar -> 502 errors.polarUnavailable
router.post('/checkout', requireAuth, (req, res) => {
  res.status(501).json({ error: 'No implementado', errorKey: 'errors.notImplemented' });
});

module.exports = router;
