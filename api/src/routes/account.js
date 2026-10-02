'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/require-auth');
const { requireFields } = require('../middleware/validate');
const { makeRateLimit } = require('../middleware/rate-limit');
const { wrap, fail } = require('../lib/errores');
const { actualizarCuenta } = require('../queries/actualizar-cuenta');
const { buscarPasswordHash } = require('../queries/buscar-password-hash');
const { verificarPassword } = require('../auth/verificar-password');
const { eliminarCuenta } = require('../account/eliminar-cuenta');

const router = express.Router();

// Solo nombre en esta fase. Cambio de email/password es un flujo aparte con
// re-verificacion (fuera de alcance).
router.patch('/account', requireAuth, requireFields('nombre'), wrap(async (req, res) => {
  const user = await actualizarCuenta(req.userId, { nombre: req.body.nombre });
  if (!user) return fail(res, 401, 'errors.unauthorized', 'Usuario no encontrado');
  res.json({ user });
}));

// Adivinar la contrasena de una sesion robada: 5 intentos / 15 min por usuario.
const limitEliminar = makeRateLimit({
  max: 5,
  windowMs: 15 * 60 * 1000,
  message: 'Demasiados intentos. Proba en unos minutos.',
  keyFn: (req) => req.userId,
});

// Borrado real e irreversible. Exige la contrasena aunque haya token valido.
router.delete('/account', requireAuth, limitEliminar, requireFields('password'), wrap(async (req, res) => {
  const hash = await buscarPasswordHash(req.userId);
  if (!hash) return fail(res, 401, 'errors.unauthorized', 'Usuario no encontrado');
  if (!(await verificarPassword(req.body.password, hash))) {
    return fail(res, 403, 'errors.wrongPassword', 'Contrasena incorrecta');
  }

  try {
    await eliminarCuenta(req.userId);
  } catch (err) {
    if (err.code === 'polar_no_configurado') {
      return fail(res, 501, 'errors.notImplemented', 'Billing no configurado');
    }
    if (err.code === 'polar_no_disponible') {
      console.error(`[account] eliminar fallo en Polar (user ${req.userId}): ${err.status || err.code || err.name}`);
      return fail(res, 502, 'errors.polarUnavailable', 'No se pudo cancelar la suscripcion; no se borro nada');
    }
    throw err;
  }
  console.log(`[account] cuenta eliminada user=${req.userId}`);
  res.json({ ok: true });
}));

module.exports = router;
