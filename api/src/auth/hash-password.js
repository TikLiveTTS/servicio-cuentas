'use strict';

const bcrypt = require('bcryptjs');

// bcrypt con cost 10. El pepper (SESSION_SECRET) se concatena para que un dump
// de la tabla users sin el secreto no permita crackear offline con rainbow.
const config = require('../config');

function hashPassword(plain) {
  return bcrypt.hash(String(plain) + config.sessionSecret, 10);
}

module.exports = { hashPassword };
