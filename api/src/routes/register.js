'use strict';

const express = require('express');
const { makeRateLimit } = require('../middleware/rate-limit');
const { requireFields, isEmail } = require('../middleware/validate');
const { fail, wrap } = require('../lib/errores');
const { hashPassword } = require('../auth/hash-password');
const { crearUsuario } = require('../queries/crear-usuario');
const { crearSesion } = require('../queries/crear-sesion');
const { estadoCuenta } = require('../queries/estado-cuenta');

const router = express.Router();
const limit = makeRateLimit({ max: 10, windowMs: 15 * 60 * 1000 });

router.post('/register', limit, requireFields('email', 'password', 'nombre'), wrap(async (req, res) => {
  const { email, password, nombre } = req.body;
  if (!isEmail(email)) return fail(res, 400, 'errors.invalidBody', 'Email invalido');
  if (String(password).length < 8) {
    return fail(res, 400, 'errors.weakPassword', 'La contrasena debe tener al menos 8 caracteres');
  }

  let user;
  try {
    user = await crearUsuario({ email, passwordHash: await hashPassword(password), nombre });
  } catch (err) {
    if (err.code === 'email_taken') {
      return fail(res, 409, 'errors.emailTaken', 'Ese email ya esta registrado');
    }
    throw err;
  }

  const { token, expiresAt } = await crearSesion(user.id);
  const estado = await estadoCuenta(user.id);
  res.status(201).json({ token, expiresAt, ...estado });
}));

module.exports = router;
