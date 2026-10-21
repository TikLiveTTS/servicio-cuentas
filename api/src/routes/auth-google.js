'use strict';

const express = require('express');
const { makeRateLimit } = require('../middleware/rate-limit');
const { requireFields } = require('../middleware/validate');
const { fail, wrap } = require('../lib/errores');
const { intercambiarCodeGoogle } = require('../auth/google');
const { buscarIdentidad } = require('../queries/buscar-identidad');
const { buscarUsuarioPorEmail } = require('../queries/buscar-usuario-por-email');
const { crearUsuario } = require('../queries/crear-usuario');
const { vincularIdentidad } = require('../queries/vincular-identidad');
const { crearSesion } = require('../queries/crear-sesion');
const { estadoCuenta } = require('../queries/estado-cuenta');

const router = express.Router();
const limit = makeRateLimit({ max: 10, windowMs: 15 * 60 * 1000 });
const PROVIDER = 'google';

// Login o alta con Google. Si el email de Google coincide con una cuenta ya
// registrada por password (sin Google vinculado todavia), NO autologuea ni
// vincula solo: corta con 409 y manda a loguear con contrasena. Vincular es
// un paso explicito aparte (POST /api/account/link/google, con sesion).
router.post('/google', limit, requireFields('code', 'codeVerifier', 'redirectUri'), wrap(async (req, res) => {
  const { code, codeVerifier, redirectUri } = req.body;

  let perfil;
  try {
    perfil = await intercambiarCodeGoogle({ code, codeVerifier, redirectUri });
  } catch (err) {
    if (err.code === 'google_no_configurado') {
      return fail(res, 501, 'errors.notImplemented', 'Login con Google no configurado');
    }
    if (err.code === 'google_redirect_invalido' || err.code === 'google_token_invalido') {
      return fail(res, 400, 'errors.invalidGoogleToken', 'No se pudo validar el login de Google');
    }
    throw err;
  }
  if (!perfil.emailVerified) {
    return fail(res, 400, 'errors.googleEmailNoVerificado', 'El email de Google no esta verificado');
  }

  const identidad = await buscarIdentidad(PROVIDER, perfil.sub);
  let userId;
  if (identidad) {
    userId = identidad.user_id;
  } else {
    const existente = await buscarUsuarioPorEmail(perfil.email);
    if (existente) {
      return fail(
        res,
        409,
        'errors.googleEmailYaRegistrado',
        'Ese email ya tiene una cuenta. Inicia sesion con tu contrasena y vincula Google desde tu perfil.'
      );
    }
    const nuevo = await crearUsuario({ email: perfil.email, passwordHash: null, nombre: perfil.name });
    await vincularIdentidad({ userId: nuevo.id, provider: PROVIDER, providerUserId: perfil.sub, email: perfil.email });
    userId = nuevo.id;
  }

  const { token, expiresAt } = await crearSesion(userId);
  const estado = await estadoCuenta(userId);
  res.json({ token, expiresAt, ...estado });
}));

module.exports = router;
