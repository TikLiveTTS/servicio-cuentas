'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/require-auth');
const { requireFields } = require('../middleware/validate');
const { makeRateLimit } = require('../middleware/rate-limit');
const { wrap, fail } = require('../lib/errores');
const { actualizarCuenta } = require('../queries/actualizar-cuenta');
const { eliminarCuenta } = require('../account/eliminar-cuenta');
const { confirmarIdentidadBorrado } = require('../account/confirmar-identidad-borrado');
const { intercambiarCodeGoogle } = require('../auth/google');
const { buscarIdentidadUsuario } = require('../queries/buscar-identidad-usuario');
const { vincularIdentidad } = require('../queries/vincular-identidad');
const { listarIdentidades } = require('../queries/listar-identidades');
const { desvincularIdentidad } = require('../queries/desvincular-identidad');
const { tienePassword } = require('../queries/tiene-password');

const router = express.Router();

// Solo nombre en esta fase. Cambio de email/password es un flujo aparte con
// re-verificacion (fuera de alcance).
router.patch('/account', requireAuth, requireFields('nombre'), wrap(async (req, res) => {
  let user;
  try {
    user = await actualizarCuenta(req.userId, { nombre: req.body.nombre });
  } catch (err) {
    if (err.code === 'nickname_taken') return fail(res, 409, 'errors.nicknameTaken', 'Ese nickname ya esta en uso');
    throw err;
  }
  if (!user) return fail(res, 401, 'errors.unauthorized', 'Usuario no encontrado');
  res.json({ user });
}));

// Que proveedores de login tiene vinculados, para que el perfil sepa que
// botones mostrar como "vincular" vs "ya vinculado".
router.get('/account/identities', requireAuth, wrap(async (req, res) => {
  const identidades = await listarIdentidades(req.userId);
  res.json({
    identities: identidades.map((i) => ({ provider: i.provider, email: i.email, linkedAt: i.created_at })),
  });
}));

const limitLinkGoogle = makeRateLimit({
  max: 10,
  windowMs: 15 * 60 * 1000,
  keyFn: (req) => req.userId,
});

// Vincula Google a la cuenta ya logueada (por cualquier metodo). No exige
// que el email de Google coincida con el de la cuenta: cubre tanto el caso
// de emails iguales como el de cuentas viejas con un email inventado.
router.post(
  '/account/link/google',
  requireAuth,
  limitLinkGoogle,
  requireFields('code', 'codeVerifier', 'redirectUri'),
  wrap(async (req, res) => {
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

    const propia = await buscarIdentidadUsuario(req.userId, 'google');
    if (propia) {
      if (propia.provider_user_id === perfil.sub) return res.json({ ok: true }); // ya vinculada, no-op
      return fail(res, 409, 'errors.identidadTomada', 'Ya tenes otra cuenta de Google vinculada; desvincula esa primero');
    }

    try {
      await vincularIdentidad({ userId: req.userId, provider: 'google', providerUserId: perfil.sub, email: perfil.email });
    } catch (err) {
      if (err.code === 'identidad_tomada' || err.code === 'ya_vinculado') {
        return fail(res, 409, 'errors.identidadTomada', 'Esa cuenta de Google ya esta vinculada a otro usuario');
      }
      throw err;
    }
    res.json({ ok: true });
  })
);

// Desvincula Google del login (no toca plataformas_vinculadas, eso es
// /account/link/:plataforma en plataformas.js). Bloqueado si seria la unica
// forma de login que le queda al usuario (sin password y sin otra identidad).
router.delete('/account/link/google', requireAuth, limitLinkGoogle, wrap(async (req, res) => {
  const [conPassword, identidades] = await Promise.all([
    tienePassword(req.userId),
    listarIdentidades(req.userId),
  ]);
  const otrasIdentidades = identidades.some((i) => i.provider !== 'google');
  if (!conPassword && !otrasIdentidades) {
    return fail(res, 409, 'errors.googleUnlinkSinPassword', 'Desvincula eso te dejaria sin forma de iniciar sesion');
  }
  await desvincularIdentidad(req.userId, 'google');
  res.json({ ok: true });
}));

// Adivinar la contrasena de una sesion robada: 5 intentos / 15 min por usuario.
const limitEliminar = makeRateLimit({
  max: 5,
  windowMs: 15 * 60 * 1000,
  message: 'Demasiados intentos. Proba en unos minutos.',
  keyFn: (req) => req.userId,
});

// Borrado real e irreversible. Exige confirmar identidad aunque haya token
// valido: con password si la cuenta tiene, o re-autenticando con Google si
// nacio sin password.
router.delete('/account', requireAuth, limitEliminar, wrap(async (req, res) => {
  const confirmacion = await confirmarIdentidadBorrado(req.userId, req.body || {});
  if (!confirmacion.ok) return fail(res, confirmacion.status, confirmacion.errorKey, confirmacion.error);

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
