'use strict';

const bcrypt = require('bcryptjs');
const config = require('../config');

function verificarPassword(plain, hash) {
  return bcrypt.compare(String(plain) + config.sessionSecret, String(hash || ''));
}

module.exports = { verificarPassword };
