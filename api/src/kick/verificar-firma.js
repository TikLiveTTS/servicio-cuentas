'use strict';

const crypto = require('crypto');

// Kick firma sus webhooks con RSA (no con un secreto compartido como
// Twitch): no hay nada que configurar nosotros, hay que pedir la clave
// publica en vivo. Kick avisa explicitamente que no se debe guardar fija
// porque la pueden rotar -- se cachea 1h nomas, no para siempre.
let claveCacheada = null;
let claveCacheadaEn = 0;
const CACHE_MS = 60 * 60 * 1000;

async function obtenerClavePublicaKick() {
  if (claveCacheada && Date.now() - claveCacheadaEn < CACHE_MS) return claveCacheada;

  const res = await fetch('https://api.kick.com/public/v1/public-key', {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Kick public-key ${res.status}: ${await res.text()}`);
  const body = await res.json();
  // Forma de la respuesta sin confirmar del todo -- se cubren las dos mas
  // probables. Verificar con el primer webhook real.
  claveCacheada = (body.data && body.data.public_key) || body.public_key;
  claveCacheadaEn = Date.now();
  return claveCacheada;
}

// Mensaje firmado: messageId + "." + timestamp + "." + body crudo
// (confirmado contra la documentacion oficial).
async function verificarFirmaKick({ messageId, timestamp, rawBody, signature }) {
  const clavePublica = await obtenerClavePublicaKick();
  const mensaje = `${messageId}.${timestamp}.${rawBody}`;
  const verificador = crypto.createVerify('RSA-SHA256');
  verificador.update(mensaje);
  verificador.end();
  return verificador.verify(clavePublica, Buffer.from(signature || '', 'base64'));
}

module.exports = { verificarFirmaKick };
