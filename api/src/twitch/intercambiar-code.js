'use strict';

const config = require('../config');

function credencialesCompletas() {
  return !!(config.twitchClientId && config.twitchClientSecret);
}

// Intercambia un authorization code por tokens de Twitch y devuelve los
// datos del canal vinculado. Lanza con code:
//   'twitch_no_configurado' — faltan las credenciales en el entorno
//   'twitch_token_invalido'  — Twitch rechazo el code o la validacion fallo
async function intercambiarCodeTwitch({ code, redirectUri }) {
  if (!credencialesCompletas()) {
    const e = new Error('Twitch OAuth no configurado (falta TWITCH_CLIENT_ID/TWITCH_CLIENT_SECRET)');
    e.code = 'twitch_no_configurado';
    throw e;
  }

  const params = new URLSearchParams({
    client_id: config.twitchClientId,
    client_secret: config.twitchClientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  let tokens;
  try {
    const res = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Twitch token ${res.status}: ${await res.text()}`);
    tokens = await res.json();
  } catch (err) {
    const e = new Error(`Twitch rechazo el code: ${err.message}`);
    e.code = 'twitch_token_invalido';
    throw e;
  }

  // /oauth2/validate da el user_id/login/scopes del token en una sola
  // llamada, sin pegarle aparte a la API de Helix.
  let perfil;
  try {
    const res = await fetch('https://id.twitch.tv/oauth2/validate', {
      headers: { Authorization: `OAuth ${tokens.access_token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Twitch validate ${res.status}: ${await res.text()}`);
    perfil = await res.json();
  } catch (err) {
    const e = new Error(`No se pudo validar el token de Twitch: ${err.message}`);
    e.code = 'twitch_token_invalido';
    throw e;
  }

  return {
    userId: String(perfil.user_id),
    username: perfil.login,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresIn: tokens.expires_in,
    scopes: perfil.scopes || [],
  };
}

module.exports = { intercambiarCodeTwitch };
