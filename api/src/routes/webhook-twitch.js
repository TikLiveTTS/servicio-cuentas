'use strict';

const express = require('express');
const { verificarFirmaTwitch } = require('../twitch/verificar-firma');
const { buscarUsuarioPorPlataforma } = require('../queries/buscar-usuario-por-plataforma');
const { enviarEventoAUsuario } = require('../realtime/servidor');

const router = express.Router();

// express.raw: la firma necesita el body crudo, sin parsear. Se monta en
// index.js ANTES del express.json() global (igual que webhook-polar.js).
router.post('/webhooks/twitch', express.raw({ type: '*/*', limit: '256kb' }), async (req, res) => {
  const messageId = req.get('Twitch-Eventsub-Message-Id') || '';
  const timestamp = req.get('Twitch-Eventsub-Message-Timestamp') || '';
  const signature = req.get('Twitch-Eventsub-Message-Signature') || '';
  const tipoMensaje = req.get('Twitch-Eventsub-Message-Type') || '';
  const rawBody = req.body.toString('utf8');

  let valido;
  try {
    valido = verificarFirmaTwitch({ messageId, timestamp, rawBody, signature });
  } catch (err) {
    if (err.code === 'twitch_webhook_no_configurado') {
      return res.status(501).json({ error: 'Webhook no configurado', errorKey: 'errors.notImplemented' });
    }
    console.error('[webhook-twitch] error verificando firma:', err.message);
    return res.status(500).json({ error: 'Error interno', errorKey: 'errors.internal' });
  }
  if (!valido) {
    return res.status(403).json({ error: 'Firma invalida', errorKey: 'errors.invalidSignature' });
  }

  const body = JSON.parse(rawBody);

  // Twitch manda un desafio al crear la suscripcion -- confirmar que el
  // endpoint esta vivo devolviendolo tal cual, texto plano.
  if (tipoMensaje === 'webhook_callback_verification') {
    return res.type('text/plain').send(body.challenge);
  }
  if (tipoMensaje === 'revocation') {
    console.warn('[webhook-twitch] suscripcion revocada:', body.subscription && body.subscription.type);
    return res.sendStatus(204);
  }

  const broadcasterId = body.event && (body.event.broadcaster_user_id || body.event.to_broadcaster_user_id);
  if (broadcasterId) {
    const userId = await buscarUsuarioPorPlataforma('twitch', String(broadcasterId));
    if (userId) {
      enviarEventoAUsuario(userId, {
        plataforma: 'twitch',
        tipo: body.subscription && body.subscription.type,
        datos: body.event,
      });
    }
  }
  res.sendStatus(204);
});

module.exports = router;
