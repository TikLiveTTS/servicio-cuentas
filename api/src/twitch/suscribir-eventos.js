'use strict';

const config = require('../config');
const { obtenerAppTokenTwitch } = require('./token-app');

// SIN CONFIRMAR: Twitch menciona para channel.chat.message con transporte
// webhook que ademas de user:read:chat puede hacer falta scope user:bot +
// (channel:bot del broadcaster o ser moderador) -- no quedo claro en la
// documentacion si aplica siempre o solo en casos puntuales. Si la
// suscripcion de chat falla, este es el primer lugar a revisar: agregar
// 'user:bot' a los scopes que se piden en twitch/intercambiar-code.js.
const EVENTOS = [
  { type: 'channel.chat.message', version: '1', condicionExtra: (broadcasterId) => ({ user_id: broadcasterId }) },
  { type: 'channel.subscribe', version: '1', condicionExtra: () => ({}) },
  { type: 'channel.cheer', version: '1', condicionExtra: () => ({}) },
];

// Mejor esfuerzo: si una suscripcion falla, se loguea y se sigue con las
// demas (no tiene sentido que channel.cheer falle solo porque chat.message
// tuvo un problema de scopes).
async function suscribirEventosTwitch(broadcasterId) {
  const appToken = await obtenerAppTokenTwitch();
  const exitosos = [];

  for (const evento of EVENTOS) {
    const res = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${appToken}`,
        'Client-Id': config.twitchClientId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: evento.type,
        version: evento.version,
        condition: { broadcaster_user_id: broadcasterId, ...evento.condicionExtra(broadcasterId) },
        transport: {
          method: 'webhook',
          callback: `${config.publicUrl}/api/webhooks/twitch`,
          secret: config.twitchWebhookSecret,
        },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error(`[twitch] no se pudo suscribir a ${evento.type} (broadcaster ${broadcasterId}): ${res.status} ${await res.text()}`);
      continue;
    }
    exitosos.push(evento.type);
  }
  return exitosos;
}

module.exports = { suscribirEventosTwitch };
