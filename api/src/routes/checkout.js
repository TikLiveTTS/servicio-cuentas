'use strict';

const express = require('express');
const config = require('../config');
const { requireAuth } = require('../middleware/require-auth');
const { fail, wrap } = require('../lib/errores');
const { buscarUsuarioPorId } = require('../queries/buscar-usuario-por-id');
const { crearCheckout } = require('../polar/crear-checkout');

const router = express.Router();

router.post('/checkout', requireAuth, wrap(async (req, res) => {
  const plan = (req.body && req.body.plan) || 'pro';
  if (plan !== 'pro') return fail(res, 400, 'errors.invalidBody', 'Plan desconocido');
  if (!config.polarApiKey || !config.polarProductIdProAnual) {
    return fail(res, 501, 'errors.notImplemented', 'Checkout no configurado (Polar)');
  }

  const user = await buscarUsuarioPorId(req.userId);
  if (!user) return fail(res, 401, 'errors.unauthorized', 'Usuario no encontrado');

  try {
    const { url } = await crearCheckout({
      productId: config.polarProductIdProAnual,
      customerEmail: user.email,
      externalCustomerId: user.id,
      successUrl: `${config.publicUrl}/api/checkout/ok?checkout_id={CHECKOUT_ID}`,
    });
    res.json({ url });
  } catch (err) {
    if (err.code === 'polar_no_configurado') {
      return fail(res, 501, 'errors.notImplemented', 'Checkout no configurado');
    }
    console.error('[checkout] Polar fallo:', err.message);
    return fail(res, 502, 'errors.polarUnavailable', 'No se pudo iniciar el pago');
  }
}));

// Pagina de retorno de Polar (el usuario vuelve aca en el navegador externo).
router.get('/checkout/ok', (req, res) => {
  res.type('html').send(`<!doctype html><meta charset=utf-8>
<title>Pago recibido</title>
<style>body{font:16px system-ui;margin:15vh auto;max-width:28rem;text-align:center;color:#222}</style>
<h1>&#10003; Pago recibido</h1>
<p>Ya podes cerrar esta pesta&#241;a y volver a TikLive TTS. Tu plan Pro se
activa en unos segundos.</p>`);
});

module.exports = router;
