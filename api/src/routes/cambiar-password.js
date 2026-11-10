'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/require-auth');
const { requireFields } = require('../middleware/validate');
const { makeRateLimit } = require('../middleware/rate-limit');
const { fail, wrap } = require('../lib/errores');
const { buscarPasswordHash } = require('../queries/buscar-password-hash');
const { verificarPassword } = require('../auth/verificar-password');
const { hashPassword } = require('../auth/hash-password');
const { actualizarPassword } = require('../queries/actualizar-password');
const { invalidarOtrasSesiones } = require('../queries/invalidar-sesion');

const router = express.Router();

// Adivinar la contraseña actual con una sesion robada: 5 intentos / 15 min por
// usuario (mismo criterio que borrar la cuenta, ver account.js).
const limit = makeRateLimit({
  max: 5,
  windowMs: 15 * 60 * 1000,
  message: 'Demasiados intentos. Proba en unos minutos.',
  keyFn: (req) => req.userId,
});

// Cambiar la contraseña con la sesion iniciada: exige la actual. Es distinto de
// "olvide mi contraseña" (forgot-password.js), que se hace sin sesion y con un
// codigo por email. Las cuentas que nacieron con Google no tienen contraseña:
// no hay "actual" que verificar, asi que no pueden usar esto.
router.patch('/account/password', requireAuth, limit, requireFields('currentPassword', 'newPassword'), wrap(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (newPassword.length < 8) return fail(res, 400, 'errors.weakPassword', 'La contrasena debe tener al menos 8 caracteres');

  const hashActual = await buscarPasswordHash(req.userId);
  if (!hashActual) return fail(res, 409, 'errors.sinPassword', 'Esta cuenta no tiene contrasena (inicia sesion con Google)');

  // 403 y no 401: el front trata 401 como "sesion vencida".
  if (!(await verificarPassword(currentPassword, hashActual))) {
    return fail(res, 403, 'errors.wrongPassword', 'Contrasena incorrecta');
  }

  await actualizarPassword(req.userId, await hashPassword(newPassword));
  await invalidarOtrasSesiones(req.userId, req.token);
  res.json({ ok: true });
}));

module.exports = router;
