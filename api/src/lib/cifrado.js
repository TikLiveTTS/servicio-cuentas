'use strict';

// Cifra/descifra tokens de OAuth de plataformas externas (Twitch, Kick) para
// no guardarlos en texto plano. AES-256-GCM con el modulo crypto nativo de
// Node — sin dependencia nueva. Distinto del hash de passwords (bcrypt, que
// nunca se puede revertir): esto SI se tiene que poder recuperar para volver
// a usar el token.

const crypto = require('crypto');
const config = require('../config');

const ALGORITMO = 'aes-256-gcm';

function clave() {
  if (!config.tokensEncryptionKey) {
    const e = new Error('TOKENS_ENCRYPTION_KEY no configurada');
    e.code = 'cifrado_no_configurado';
    throw e;
  }
  return Buffer.from(config.tokensEncryptionKey, 'hex');
}

// Formato guardado: "iv.tag.cifrado", cada parte en base64url.
function cifrar(texto) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITMO, clave(), iv);
  const cifrado = Buffer.concat([cipher.update(String(texto), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, cifrado].map((b) => b.toString('base64url')).join('.');
}

function descifrar(valor) {
  const [ivB64, tagB64, cifradoB64] = String(valor).split('.');
  const decipher = crypto.createDecipheriv(ALGORITMO, clave(), Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  const texto = Buffer.concat([decipher.update(Buffer.from(cifradoB64, 'base64url')), decipher.final()]);
  return texto.toString('utf8');
}

module.exports = { cifrar, descifrar };
