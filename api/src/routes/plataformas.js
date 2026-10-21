'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/require-auth');
const { requireFields } = require('../middleware/validate');
const { makeRateLimit } = require('../middleware/rate-limit');
const { fail, wrap } = require('../lib/errores');
const { cifrar } = require('../lib/cifrado');
const { intercambiarCodeTwitch } = require('../twitch/intercambiar-code');
const { intercambiarCodeKick } = require('../kick/intercambiar-code');
const { buscarPlataformaUsuario } = require('../queries/buscar-plataforma-usuario');
const { guardarPlataforma } = require('../queries/guardar-plataforma');
const { listarPlataformas } = require('../queries/listar-plataformas');
const { desvincularPlataforma } = require('../queries/desvincular-plataforma');
const { suscribirEventosTwitch } = require('../twitch/suscribir-eventos');
const { suscribirEventosKick } = require('../kick/suscribir-eventos');

const router = express.Router();
const limit = makeRateLimit({ max: 10, windowMs: 15 * 60 * 1000, keyFn: (req) => req.userId });
const PLATAFORMAS_VALIDAS = ['twitch', 'kick'];

// Comun a Twitch y Kick una vez que ya se obtuvo el perfil verificado: no
// vincula si el usuario ya tiene OTRA cuenta de esa plataforma (sin
// desvincular antes), y es no-op si ya es exactamente esa misma cuenta.
// `suscribirEventos` corre DESPUES de responder, mejor esfuerzo -- si falla
// no afecta el vinculo (que ya quedo guardado).
async function vincular(req, res, plataforma, perfil, suscribirEventos) {
  const propia = await buscarPlataformaUsuario(req.userId, plataforma);
  if (propia) {
    if (propia.plataforma_user_id === perfil.userId) return res.json({ ok: true });
    return fail(
      res,
      409,
      'errors.plataformaTomada',
      `Ya tenes otra cuenta de ${plataforma} vinculada; desvincula esa primero`
    );
  }

  try {
    await guardarPlataforma({
      userId: req.userId,
      plataforma,
      plataformaUserId: perfil.userId,
      plataformaUsername: perfil.username,
      accessTokenCifrado: cifrar(perfil.accessToken),
      refreshTokenCifrado: cifrar(perfil.refreshToken),
      expiresAt: new Date(Date.now() + perfil.expiresIn * 1000),
      scopes: perfil.scopes,
    });
  } catch (err) {
    if (err.code === 'plataforma_tomada' || err.code === 'ya_vinculado') {
      return fail(res, 409, 'errors.plataformaTomada', `Esa cuenta de ${plataforma} ya esta vinculada a otro usuario`);
    }
    throw err;
  }
  res.json({ ok: true });
  suscribirEventos().catch((err) => {
    console.error(`[${plataforma}] fallo suscribir eventos tras vincular (user ${req.userId}):`, err.message);
  });
}

router.post(
  '/account/link/twitch',
  requireAuth,
  limit,
  requireFields('code', 'redirectUri'),
  wrap(async (req, res) => {
    let perfil;
    try {
      perfil = await intercambiarCodeTwitch({ code: req.body.code, redirectUri: req.body.redirectUri });
    } catch (err) {
      if (err.code === 'twitch_no_configurado') return fail(res, 501, 'errors.notImplemented', 'Vincular Twitch no configurado');
      if (err.code === 'twitch_token_invalido') {
        return fail(res, 400, 'errors.invalidPlatformToken', 'No se pudo validar el login de Twitch');
      }
      throw err;
    }
    await vincular(req, res, 'twitch', perfil, () => suscribirEventosTwitch(perfil.userId));
  })
);

router.post(
  '/account/link/kick',
  requireAuth,
  limit,
  requireFields('code', 'codeVerifier', 'redirectUri'),
  wrap(async (req, res) => {
    let perfil;
    try {
      perfil = await intercambiarCodeKick({
        code: req.body.code,
        codeVerifier: req.body.codeVerifier,
        redirectUri: req.body.redirectUri,
      });
    } catch (err) {
      if (err.code === 'kick_no_configurado') return fail(res, 501, 'errors.notImplemented', 'Vincular Kick no configurado');
      if (err.code === 'kick_token_invalido') {
        return fail(res, 400, 'errors.invalidPlatformToken', 'No se pudo validar el login de Kick');
      }
      throw err;
    }
    await vincular(req, res, 'kick', perfil, () => suscribirEventosKick(perfil.accessToken, perfil.userId));
  })
);

router.get('/account/platforms', requireAuth, wrap(async (req, res) => {
  const plataformas = await listarPlataformas(req.userId);
  res.json({
    platforms: plataformas.map((p) => ({
      plataforma: p.plataforma,
      username: p.plataforma_username,
      linkedAt: p.created_at,
    })),
  });
}));

router.delete('/account/link/:plataforma', requireAuth, limit, wrap(async (req, res) => {
  const plataforma = req.params.plataforma;
  if (!PLATAFORMAS_VALIDAS.includes(plataforma)) {
    return fail(res, 400, 'errors.invalidBody', 'Plataforma desconocida');
  }
  await desvincularPlataforma(req.userId, plataforma);
  res.json({ ok: true });
}));

module.exports = router;
