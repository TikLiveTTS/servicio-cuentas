'use strict';

// SIN CONFIRMAR: no quedo claro en la documentacion de Kick donde se
// configura la URL de callback del webhook -- a diferencia de Twitch, no se
// manda por request. Lo mas probable es que se configure una vez en el
// panel de desarrollador de Kick (como la redirect URL de OAuth). Hay que
// revisar el panel antes de la primera prueba real; si hace falta pasarla
// por aca, agregar el campo al body de abajo.
const EVENTOS = [
  { name: 'chat.message.sent', version: 1 },
  { name: 'channel.followed', version: 1 },
  { name: 'channel.subscription.new', version: 1 },
  { name: 'channel.subscription.renewal', version: 1 },
  { name: 'channel.subscription.gifts', version: 1 },
  { name: 'kicks.gifted', version: 1 },
];

// Mejor esfuerzo: si falla, se loguea y no bloquea el vinculo (que ya quedo
// guardado antes de llamar a esto).
async function suscribirEventosKick(accessToken, broadcasterId) {
  const res = await fetch('https://api.kick.com/public/v1/events/subscriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ events: EVENTOS, broadcaster_user_id: Number(broadcasterId), method: 'webhook' }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    console.error(`[kick] no se pudo suscribir a eventos (broadcaster ${broadcasterId}): ${res.status} ${await res.text()}`);
    return [];
  }
  return EVENTOS.map((e) => e.name);
}

module.exports = { suscribirEventosKick };
