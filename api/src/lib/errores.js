'use strict';

// Respuesta de error uniforme: { error, errorKey }. El frontend de la app
// prefiere errorKey (traducido con tErr()) y cae a error crudo.

function fail(res, status, errorKey, error) {
  return res.status(status).json({ error: error || errorKey, errorKey });
}

// Envuelve un handler async para que un throw no tumbe el proceso.
function wrap(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { fail, wrap };
