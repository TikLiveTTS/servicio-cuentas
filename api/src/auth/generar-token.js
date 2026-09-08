'use strict';

const crypto = require('crypto');

// Token opaco: 32 bytes aleatorios en base64url. No lleva información, es solo
// una clave de la tabla sessions.
function generarToken() {
  return crypto.randomBytes(32).toString('base64url');
}

module.exports = { generarToken };
