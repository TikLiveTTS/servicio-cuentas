'use strict';

const config = require('../config');

function credencialesCompletas() {
  return !!(config.kickClientId && config.kickClientSecret);
}

// Intercambia un authorization code (Kick exige PKCE + client_secret a la
// vez, a diferencia de Google/Twitch) por tokens de Kick y devuelve los
// datos del canal vinculado. Lanza con code:
//   'kick_no_configurado' — faltan las credenciales en el entorno
//   'kick_token_invalido'  — Kick rechazo el code o la consulta de perfil fallo
async function intercambiarCodeKick({ code, codeVerifier, redirectUri }) {
  if (!credencialesCompletas()) {
    const e = new Error('Kick OAuth no configurado (falta KICK_CLIENT_ID/KICK_CLIENT_SECRET)');
    e.code = 'kick_no_configurado';
    throw e;
  }

  const params = new URLSearchParams({
    client_id: config.kickClientId,
    client_secret: config.kickClientSecret,
    code,
    code_verifier: codeVerifier,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  let tokens;
  try {
    const res = await fetch('https://id.kick.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Kick token ${res.status}: ${await res.text()}`);
    tokens = await res.json();
  } catch (err) {
    const e = new Error(`Kick rechazo el code: ${err.message}`);
    e.code = 'kick_token_invalido';
    throw e;
  }

  // Forma exacta de la respuesta de /public/v1/users sin confirmar del todo
  // (API nueva, poco documentada) — se cubren las formas mas probables
  // ({data:[...]}, {data:{...}}, objeto plano). Verificar con la primera
  // vinculacion real.
  let perfil;
  try {
    const res = await fetch('https://api.kick.com/public/v1/users', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Kick users ${res.status}: ${await res.text()}`);
    const body = await res.json();
    perfil = Array.isArray(body.data) ? body.data[0] : body.data || body;
  } catch (err) {
    const e = new Error(`No se pudo obtener el perfil de Kick: ${err.message}`);
    e.code = 'kick_token_invalido';
    throw e;
  }

  return {
    userId: String(perfil.user_id),
    username: perfil.name,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresIn: tokens.expires_in,
    scopes: String(tokens.scope || '').split(' ').filter(Boolean),
  };
}

module.exports = { intercambiarCodeKick };
