'use strict';

const express = require('express');
const { makeRateLimit } = require('../middleware/rate-limit');
const { fail, wrap } = require('../lib/errores');
const { twitchEnVivo } = require('../twitch/consultar-en-vivo');

const router = express.Router();

// Sin auth a proposito: la app tambien conecta canales de Twitch sin sesion.
// Solo devuelve un booleano de un dato publico. Lo que lo acota: rate limit
// por IP, login validado y cache de 30 s en consultar-en-vivo.js.
const limit = makeRateLimit({ max: 120, windowMs: 60 * 1000 });
const LOGIN_VALIDO = /^[a-z0-9_]{1,25}$/;

router.get('/twitch/live', limit, wrap(async (req, res) => {
  const login = String(req.query.login || '').trim().toLowerCase();
  if (!LOGIN_VALIDO.test(login)) return fail(res, 400, 'errors.invalidBody', 'Login de Twitch invalido');

  try {
    return res.json({ live: await twitchEnVivo(login) });
  } catch (err) {
    if (err.code === 'twitch_no_configurado') return fail(res, 501, 'errors.notImplemented', 'Twitch no configurado');
    console.error(`[twitch-live] consulta fallo (${login}):`, err.message);
    return fail(res, 502, 'errors.serviceUnavailable', 'No se pudo consultar Twitch');
  }
}));

module.exports = router;
