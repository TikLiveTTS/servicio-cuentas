'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/require-auth');
const { makeRateLimit } = require('../middleware/rate-limit');
const { fail, wrap } = require('../lib/errores');
const { firmarSubida } = require('../cloudinary/firmar-subida');
const { tocarAvatar, tocarBanner } = require('../queries/tocar-imagen-perfil');
const { estadoCuenta } = require('../queries/estado-cuenta');

const router = express.Router();
const limit = makeRateLimit({ max: 20, windowMs: 15 * 60 * 1000, keyFn: (req) => req.userId });

router.post('/account/avatar/firma', requireAuth, limit, wrap(async (req, res) => {
  let firma;
  try {
    firma = firmarSubida(`avatares/${req.userId}`);
  } catch (err) {
    if (err.code === 'cloudinary_no_configurado') {
      return fail(res, 501, 'errors.notImplemented', 'Subida de imagenes no configurada');
    }
    throw err;
  }
  res.json(firma);
}));

router.post('/account/banner/firma', requireAuth, limit, wrap(async (req, res) => {
  let firma;
  try {
    firma = firmarSubida(`banners/${req.userId}`);
  } catch (err) {
    if (err.code === 'cloudinary_no_configurado') {
      return fail(res, 501, 'errors.notImplemented', 'Subida de imagenes no configurada');
    }
    throw err;
  }
  res.json(firma);
}));

// La app llama esto despues de que Cloudinary confirmo la subida (no se
// confia en ninguna URL que mande el cliente: solo se marca la fecha).
// Devuelve la sesion completa (mismo shape que /api/session) para que el
// cliente la pase directo a aplicarSesion() y la URL nueva se vea sin
// recargar -- un {ok:true} pelado no le daba al cliente nada con que pintar.
router.post('/account/avatar/confirmar', requireAuth, limit, wrap(async (req, res) => {
  await tocarAvatar(req.userId);
  res.json(await estadoCuenta(req.userId));
}));

router.post('/account/banner/confirmar', requireAuth, limit, wrap(async (req, res) => {
  await tocarBanner(req.userId);
  res.json(await estadoCuenta(req.userId));
}));

module.exports = router;
