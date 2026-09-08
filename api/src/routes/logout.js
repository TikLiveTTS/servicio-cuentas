'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/require-auth');
const { wrap } = require('../lib/errores');
const { invalidarSesion } = require('../queries/invalidar-sesion');

const router = express.Router();

router.post('/logout', requireAuth, wrap(async (req, res) => {
  await invalidarSesion(req.token);
  res.json({ ok: true });
}));

module.exports = router;
