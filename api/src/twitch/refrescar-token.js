'use strict';

const config = require('../config');

// Renueva un access token de Twitch vencido usando el refresh token
// guardado. Lanza con code 'twitch_refresh_invalido' si Twitch lo rechaza
// (el usuario revoco el acceso, cambio password, etc. -- el llamador deberia
// pedirle que reconecte desde cero, no hay forma de recuperar esto solo).
async function refrescarTokenTwitch(refreshToken) {
  const params = new URLSearchParams({
    client_id: config.twitchClientId,
    client_secret: config.twitchClientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const e = new Error(`Twitch rechazo el refresh: ${res.status} ${await res.text()}`);
    e.code = 'twitch_refresh_invalido';
    throw e;
  }
  const tokens = await res.json();
  return { accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresIn: tokens.expires_in };
}

module.exports = { refrescarTokenTwitch };
