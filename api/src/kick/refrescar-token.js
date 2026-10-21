'use strict';

const config = require('../config');

// Renueva un access token de Kick vencido usando el refresh token guardado.
// El refresh token de Kick rota en cada uso (confirmado contra la
// documentacion) -- siempre hay que guardar el nuevo, nunca reusar el viejo.
// Lanza con code 'kick_refresh_invalido' si Kick lo rechaza.
async function refrescarTokenKick(refreshToken) {
  const params = new URLSearchParams({
    client_id: config.kickClientId,
    client_secret: config.kickClientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const res = await fetch('https://id.kick.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const e = new Error(`Kick rechazo el refresh: ${res.status} ${await res.text()}`);
    e.code = 'kick_refresh_invalido';
    throw e;
  }
  const tokens = await res.json();
  return { accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresIn: tokens.expires_in };
}

module.exports = { refrescarTokenKick };
