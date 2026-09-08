'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/require-auth');
const { requireFields } = require('../middleware/validate');
const { wrap, fail } = require('../lib/errores');
const { actualizarCuenta } = require('../queries/actualizar-cuenta');

const router = express.Router();

// Solo nombre en esta fase. Cambio de email/password es un flujo aparte con
// re-verificacion (fuera de alcance).
router.patch('/account', requireAuth, requireFields('nombre'), wrap(async (req, res) => {
  const user = await actualizarCuenta(req.userId, { nombre: req.body.nombre });
  if (!user) return fail(res, 401, 'errors.unauthorized', 'Usuario no encontrado');
  res.json({ user });
}));

module.exports = router;
