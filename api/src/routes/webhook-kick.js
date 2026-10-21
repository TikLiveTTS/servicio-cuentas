'use strict';

const express = require('express');
const { verificarFirmaKick } = require('../kick/verificar-firma');
const { buscarUsuarioPorPlataforma } = require('../queries/buscar-usuario-por-plataforma');
const { enviarEventoAUsuario } = require('../realtime/servidor');

const router = express.Router();

router.post('/webhooks/kick', express.raw({ type: '*/*', limit: '256kb' }), async (req, res) => {
  const messageId = req.get('Kick-Event-Message-Id') || '';
  const timestamp = req.get('Kick-Event-Message-Timestamp') || '';
  const signature = req.get('Kick-Event-Signature') || '';
  const tipoEvento = req.get('Kick-Event-Type') || '';
  const rawBody = req.body.toString('utf8');

  let valido;
  try {
    valido = await verificarFirmaKick({ messageId, timestamp, rawBody, signature });
  } catch (err) {
    console.error('[webhook-kick] error verificando firma:', err.message);
    return res.status(500).json({ error: 'Error interno', errorKey: 'errors.internal' });
  }
  if (!valido) {
    return res.status(403).json({ error: 'Firma invalida', errorKey: 'errors.invalidSignature' });
  }

  const body = JSON.parse(rawBody);
  // Forma exacta del payload sin confirmar del todo -- verificar con el
  // primer webhook real.
  const broadcasterId = body.broadcaster && body.broadcaster.user_id;
  if (broadcasterId) {
    const userId = await buscarUsuarioPorPlataforma('kick', String(broadcasterId));
    if (userId) {
      enviarEventoAUsuario(userId, { plataforma: 'kick', tipo: tipoEvento, datos: body });
    }
  }
  res.sendStatus(204);
});

module.exports = router;
