'use strict';

const { OAuth2Client } = require('google-auth-library');
const config = require('../config');

function cliente() {
  if (!config.googleClientId || !config.googleClientSecret) {
    const e = new Error('Google OAuth no configurado (falta GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET)');
    e.code = 'google_no_configurado';
    throw e;
  }
  return new OAuth2Client(config.googleClientId, config.googleClientSecret);
}

// Defensa extra: el redirect_uri que manda el cliente solo tiene sentido
// para el flujo de app de escritorio (loopback). Google igual lo valida
// contra el que emitio el code; esto corta antes de llamar a Google.
function esRedirectDeLoopback(redirectUri) {
  let url;
  try {
    url = new URL(redirectUri);
  } catch {
    return false;
  }
  return url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost');
}

// Intercambia un authorization code (Authorization Code + PKCE) por el
// id_token verificado de Google y devuelve los datos del perfil. Lanza con
// code:
//   'google_no_configurado'    — faltan las credenciales en el entorno
//   'google_redirect_invalido' — redirectUri no es un loopback
//   'google_token_invalido'    — Google rechazo el code o el id_token no valida
async function intercambiarCodeGoogle({ code, codeVerifier, redirectUri }) {
  if (!esRedirectDeLoopback(redirectUri)) {
    const e = new Error('redirect_uri invalido: debe ser http://127.0.0.1 o http://localhost');
    e.code = 'google_redirect_invalido';
    throw e;
  }

  const client = cliente();
  let tokens;
  try {
    ({ tokens } = await client.getToken({ code, codeVerifier, redirect_uri: redirectUri }));
  } catch (err) {
    const e = new Error(`Google rechazo el code: ${err.message}`);
    e.code = 'google_token_invalido';
    throw e;
  }

  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: config.googleClientId });
    payload = ticket.getPayload();
  } catch (err) {
    const e = new Error(`id_token de Google invalido: ${err.message}`);
    e.code = 'google_token_invalido';
    throw e;
  }

  return {
    sub: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified === true,
    name: payload.name || '',
  };
}

module.exports = { intercambiarCodeGoogle };
