'use strict';

const config = require('../config');
const { obtenerAppTokenTwitch } = require('./token-app');

// ¿El canal de Twitch esta transmitiendo ahora? Helix GET /streams con el
// token de aplicacion (la app de escritorio no tiene client_secret, por eso
// pasa por aca). Lo consulta cada app abierta cada ~60 s por cada canal de
// Twitch conectado, asi que:
//  - se cachea 30 s por login (muchas apps pueden mirar el mismo canal);
//  - las consultas simultaneas al mismo login comparten UNA sola llamada;
//  - un fallo NO se cachea (el siguiente intento vuelve a probar).

const CACHE_MS = 30_000;
const MAX_ENTRADAS = 5000;
const cache = new Map(); // login -> { promesa, expira }

function credencialesCompletas() {
  return !!(config.twitchClientId && config.twitchClientSecret);
}

async function pedirAHelix(login) {
  const appToken = await obtenerAppTokenTwitch();
  const res = await fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(login)}`, {
    headers: { Authorization: `Bearer ${appToken}`, 'Client-Id': config.twitchClientId },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Twitch streams ${res.status}: ${await res.text()}`);
  const { data } = await res.json();
  return Array.isArray(data) && data.some((s) => s && s.type === 'live');
}

function podar(ahora) {
  for (const [login, e] of cache) if (e.expira <= ahora) cache.delete(login);
}

/** @param {string} login ya validado/en minusculas. @returns {Promise<boolean>} */
async function twitchEnVivo(login) {
  if (!credencialesCompletas()) {
    const e = new Error('Twitch no configurado (faltan TWITCH_CLIENT_ID/TWITCH_CLIENT_SECRET)');
    e.code = 'twitch_no_configurado';
    throw e;
  }

  const ahora = Date.now();
  const hit = cache.get(login);
  if (hit && hit.expira > ahora) return hit.promesa;

  if (cache.size >= MAX_ENTRADAS) podar(ahora);
  const promesa = pedirAHelix(login);
  cache.set(login, { promesa, expira: ahora + CACHE_MS });
  try {
    return await promesa;
  } catch (err) {
    // No cachear fallos (solo si la entrada sigue siendo esta).
    const actual = cache.get(login);
    if (actual && actual.promesa === promesa) cache.delete(login);
    throw err;
  }
}

function _vaciarCache() { cache.clear(); }

module.exports = { twitchEnVivo, _vaciarCache };
