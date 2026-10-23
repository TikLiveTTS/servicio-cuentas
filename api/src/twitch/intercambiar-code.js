'use strict';

const config = require('../config');

// App registrada en Twitch como cliente Confidencial (dev.twitch.tv/console):
// Twitch si entrega client_secret para este tipo. Mandamos PKCE (code_verifier)
// ADEMAS del secret -- no hace falta elegir uno u otro, los dos juntos son
// validos y mas robusto si el tipo de cliente cambia de nuevo a futuro (un
// cliente Publico no tiene secret, pero el code_verifier solo ya le alcanza).
function credencialesCompletas() {
  return !!config.twitchClientId;
}

// Intercambia un authorization code (+ PKCE, + secret si esta configurado)
// por tokens de Twitch y devuelve los datos del canal vinculado. Lanza con code:
//   'twitch_no_configurado' — falta TWITCH_CLIENT_ID en el entorno
//   'twitch_token_invalido'  — Twitch rechazo el code o la validacion fallo
async function intercambiarCodeTwitch({ code, codeVerifier, redirectUri }) {
  if (!credencialesCompletas()) {
    const e = new Error('Twitch OAuth no configurado (falta TWITCH_CLIENT_ID)');
    e.code = 'twitch_no_configurado';
    throw e;
  }

  const params = new URLSearchParams({
    client_id: config.twitchClientId,
    code,
    code_verifier: codeVerifier,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });
  if (config.twitchClientSecret) params.set('client_secret', config.twitchClientSecret);

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
