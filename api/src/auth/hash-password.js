'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const config = require('../config');

// Pre-hash con HMAC-SHA256 antes de bcrypt: bcrypt trunca el input a 72
// bytes, asi que pegar el pepper (SESSION_SECRET) DESPUES de una contraseña
// larga se puede perder. HMAC da un digest de tamaño fijo (32 bytes) que
// siempre entra completo, sin importar el largo de la contraseña original.
function conPepper(plain) {
  return crypto.createHmac('sha256', config.sessionSecret).update(String(plain)).digest('base64');
}

function hashPassword(plain) {
  return bcrypt.hash(conPepper(plain), 12);
}

module.exports = { hashPassword, conPepper };
