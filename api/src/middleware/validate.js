'use strict';

const { fail } = require('../lib/errores');

// Validación mínima de body: campos requeridos presentes y string no vacío.
function requireFields(...campos) {
  return function validate(req, res, next) {
    const body = req.body || {};
    for (const c of campos) {
      if (typeof body[c] !== 'string' || !body[c].trim()) {
        return fail(res, 400, 'errors.invalidBody', `Falta el campo: ${c}`);
      }
    }
    next();
  };
}

function isEmail(s) {
  return typeof s === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.trim());
}

module.exports = { requireFields, isEmail };
