'use strict';

const bcrypt = require('bcryptjs');
const config = require('../config');
const { conPepper } = require('./hash-password');

// Esquema nuevo primero (HMAC-SHA256 + bcrypt). Si no matchea, cae al
// esquema viejo (contraseña + pepper concatenados sin HMAC) — asi los
// hashes ya guardados de antes de este cambio siguen logueando.
async function verificarPassword(plain, hash) {
  const h = String(hash || '');
  if (await bcrypt.compare(conPepper(plain), h)) return true;
  return bcrypt.compare(String(plain) + config.sessionSecret, h);
}

module.exports = { verificarPassword };
