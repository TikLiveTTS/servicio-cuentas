'use strict';

// Punto unico desde donde cualquier parte del backend (suscribir eventos,
// mandar un mensaje de chat) obtiene un access token de Twitch/Kick listo
// para usar. Renueva solo si esta por vencer -- el usuario nunca ve esto,
// a menos que el refresh tambien falle (ahi si hay que reconectar de cero).

const { cifrar, descifrar } = require('./cifrado');
const { buscarTokensPlataforma } = require('../queries/buscar-tokens-plataforma');
const { actualizarTokensPlataforma } = require('../queries/actualizar-tokens-plataforma');
const { refrescarTokenTwitch } = require('../twitch/refrescar-token');
const { refrescarTokenKick } = require('../kick/refrescar-token');

const MARGEN_MS = 5 * 60 * 1000; // renovar si vence en menos de 5 minutos
const REFRESCAR = { twitch: refrescarTokenTwitch, kick: refrescarTokenKick };

// Lanza con code:
//   'plataforma_no_vinculada' — el usuario no tiene esa plataforma vinculada
//   'twitch_refresh_invalido' / 'kick_refresh_invalido' — la plataforma
//     rechazo el refresh (revoco el acceso, cambio password, etc.) — el
//     llamador deberia pedirle al usuario que reconecte desde cero.
async function obtenerAccessTokenVigente(userId, plataforma) {
  const fila = await buscarTokensPlataforma(userId, plataforma);
  if (!fila) {
    const e = new Error(`el usuario no tiene ${plataforma} vinculado`);
    e.code = 'plataforma_no_vinculada';
    throw e;
  }

  const vence = new Date(fila.expires_at).getTime();
  if (vence - Date.now() > MARGEN_MS) {
    return descifrar(fila.access_token_cifrado);
  }

  const nuevos = await REFRESCAR[plataforma](descifrar(fila.refresh_token_cifrado));
  await actualizarTokensPlataforma({
    userId,
    plataforma,
    accessTokenCifrado: cifrar(nuevos.accessToken),
    refreshTokenCifrado: cifrar(nuevos.refreshToken),
    expiresAt: new Date(Date.now() + nuevos.expiresIn * 1000),
  });
  return nuevos.accessToken;
}

module.exports = { obtenerAccessTokenVigente };
