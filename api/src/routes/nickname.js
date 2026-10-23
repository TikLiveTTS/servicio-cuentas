'use strict';

const express = require('express');
const { makeRateLimit } = require('../middleware/rate-limit');
const { isNickname } = require('../middleware/validate');
const { wrap, fail } = require('../lib/errores');
const { nicknameDisponible } = require('../queries/nickname-disponible');

const router = express.Router();
// Sin sesion (se usa antes de registrarse) -> limite por IP, mas laxo que
// login/register porque el usuario lo dispara en vivo mientras tipea.
const limit = makeRateLimit({ max: 30, windowMs: 15 * 60 * 1000 });

router.get('/nickname-disponible', limit, wrap(async (req, res) => {
  const nombre = String(req.query.nombre || '');
  if (!isNickname(nombre)) {
    return fail(res, 400, 'errors.invalidNickname', 'Nickname invalido (2-32 caracteres, letras/numeros/guion bajo/punto)');
  }
  const disponible = await nicknameDisponible(nombre);
  res.json({ disponible });
}));

module.exports = router;
