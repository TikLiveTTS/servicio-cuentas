'use strict';

const express = require('express');
const { makeRateLimit } = require('../middleware/rate-limit');
const { requireFields } = require('../middleware/validate');
const { fail, wrap } = require('../lib/errores');
const { buscarUsuarioPorEmail } = require('../queries/buscar-usuario-por-email');
const { verificarPassword } = require('../auth/verificar-password');
const { crearSesion } = require('../queries/crear-sesion');
const { estadoCuenta } = require('../queries/estado-cuenta');

const router = express.Router();
// 5 intentos cada 15 min por IP + 5 cada 15 min por email — la de IP sola se
// anula si el atacante manda un X-Forwarded-For distinto por request; la de
// email frena igual porque no depende de la IP declarada.
const limit = makeRateLimit({
  max: 5,
  windowMs: 15 * 60 * 1000,
  message: 'Demasiados intentos. Proba en unos minutos.',
});
const limitPorEmail = makeRateLimit({
  max: 5,
  windowMs: 15 * 60 * 1000,
  message: 'Demasiados intentos. Proba en unos minutos.',
  keyFn: (req) => String((req.body || {}).email || '').trim().toLowerCase(),
});

// Hash bcrypt de relleno: se verifica igual cuando el usuario no existe, para
// que el tiempo de respuesta no revele si el email esta registrado.
const DUMMY_HASH = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8.QzM4uV0v6yq6b8Yb3jP1nQ8kW9Iu';

router.post('/login', limit, limitPorEmail, requireFields('email', 'password'), wrap(async (req, res) => {
  const { email, password } = req.body;
  const user = await buscarUsuarioPorEmail(email);
  const ok = await verificarPassword(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok) {
    return fail(res, 401, 'errors.invalidCredentials', 'Email o contrasena incorrectos');
  }

  const { token, expiresAt } = await crearSesion(user.id);
  const estado = await estadoCuenta(user.id);
  res.json({ token, expiresAt, ...estado });
}));

module.exports = router;
