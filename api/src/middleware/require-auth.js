'use strict';

const { validarSesion } = require('../queries/validar-sesion');
const { fail } = require('../lib/errores');

// Bearer token → sesión válida. Setea req.userId.
async function requireAuth(req, res, next) {
  try {
    const h = req.get('authorization') || '';
    const token = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
    if (!token) return fail(res, 401, 'errors.unauthorized', 'Falta el token');

    const sesion = await validarSesion(token);
    if (!sesion) return fail(res, 401, 'errors.unauthorized', 'Sesión inválida o expirada');

    req.userId = sesion.user_id;
    req.token = token;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAuth };
