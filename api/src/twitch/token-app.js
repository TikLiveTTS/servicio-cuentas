'use strict';

const config = require('../config');

// Token de aplicacion (client_credentials) -- Twitch lo exige especificamente
// para crear suscripciones de EventSub con transporte webhook (rechaza un
// token de usuario para esto). Distinto de los tokens por-usuario que guarda
// plataformas_vinculadas. Se cachea hasta que este por vencer.
let tokenCacheado = null;
let expiraEn = 0;

async function obtenerAppTokenTwitch() {
  if (tokenCacheado && Date.now() < expiraEn - 60_000) return tokenCacheado;

  const params = new URLSearchParams({
    client_id: config.twitchClientId,
    client_secret: config.twitchClientSecret,
    grant_type: 'client_credentials',
  });
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Twitch app token ${res.status}: ${await res.text()}`);
  const tokens = await res.json();
  tokenCacheado = tokens.access_token;
  expiraEn = Date.now() + tokens.expires_in * 1000;
  return tokenCacheado;
}

module.exports = { obtenerAppTokenTwitch };
