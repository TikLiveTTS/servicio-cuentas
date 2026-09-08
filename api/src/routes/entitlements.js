'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/require-auth');
const { wrap, fail } = require('../lib/errores');
const { estadoCuenta } = require('../queries/estado-cuenta');

const router = express.Router();

router.get('/entitlements', requireAuth, wrap(async (req, res) => {
  const estado = await estadoCuenta(req.userId);
  if (!estado) return fail(res, 401, 'errors.unauthorized', 'Usuario no encontrado');
  res.json({ entitlements: estado.entitlements });
}));

module.exports = router;
