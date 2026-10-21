'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/require-auth');
const { requireFields } = require('../middleware/validate');
const { makeRateLimit } = require('../middleware/rate-limit');
const { fail, wrap } = require('../lib/errores');
const { obtenerAccessTokenVigente } = require('../lib/token-plataforma');
const { buscarPlataformaUsuario } = require('../queries/buscar-plataforma-usuario');
const { enviarMensajeTwitch } = require('../twitch/enviar-mensaje');
const { enviarMensajeKick } = require('../kick/enviar-mensaje');

const router = express.Router();
const limit = makeRateLimit({ max: 30, windowMs: 60 * 1000, keyFn: (req) => req.userId });

// Comun a Twitch y Kick: consigue un token vigente (renovando solo si hace
// falta) y traduce los errores de la plataforma al mismo formato de
// respuesta. Si el refresh fallo (el usuario revoco el acceso, cambio
// password, etc.), 409 para que el cliente le pida reconectar -- no hay
// countdown ni aviso previo, solo se entera si de verdad se corto.
async function conTokenVigente(req, res, plataforma, fn) {
  let accessToken;
  try {
    accessToken = await obtenerAccessTokenVigente(req.userId, plataforma);
  } catch (err) {
    if (err.code === 'plataforma_no_vinculada') {
      return fail(res, 409, 'errors.plataformaNoVinculada', `No tenes ${plataforma} vinculado`);
    }
    if (err.code === 'twitch_refresh_invalido' || err.code === 'kick_refresh_invalido') {
      return fail(
        res,
        409,
        'errors.plataformaDesconectada',
        `La conexion con ${plataforma} se corto, reconecta desde el perfil`
      );
    }
    throw err;
  }
  await fn(accessToken);
}

router.post('/platforms/twitch/chat', requireAuth, limit, requireFields('mensaje'), wrap(async (req, res) => {
  await conTokenVigente(req, res, 'twitch', async (accessToken) => {
    const propia = await buscarPlataformaUsuario(req.userId, 'twitch');
    try {
      await enviarMensajeTwitch({ accessToken, broadcasterId: propia.plataforma_user_id, mensaje: req.body.mensaje });
    } catch (err) {
      return fail(res, 502, 'errors.chatEnvioFallido', 'No se pudo mandar el mensaje a Twitch');
    }
    res.json({ ok: true });
  });
}));

router.post('/platforms/kick/chat', requireAuth, limit, requireFields('mensaje'), wrap(async (req, res) => {
  await conTokenVigente(req, res, 'kick', async (accessToken) => {
    const propia = await buscarPlataformaUsuario(req.userId, 'kick');
    try {
      await enviarMensajeKick({ accessToken, broadcasterId: propia.plataforma_user_id, mensaje: req.body.mensaje });
    } catch (err) {
      return fail(res, 502, 'errors.chatEnvioFallido', 'No se pudo mandar el mensaje a Kick');
    }
    res.json({ ok: true });
  });
}));

module.exports = router;
