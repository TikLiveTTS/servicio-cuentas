'use strict';

// Rate limit en memoria por IP. Suficiente para un solo proceso; si algún día
// hay varias réplicas, mover a Postgres o Redis.
function makeRateLimit({ max, windowMs, message, keyFn }) {
  const hits = new Map(); // key -> { count, resetAt }
  const getKey = keyFn || ((req) => req.ip || 'desconocida');

  return function rateLimit(req, res, next) {
    const now = Date.now();
    const key = getKey(req);
    let e = hits.get(key);
    if (!e || now > e.resetAt) {
      e = { count: 0, resetAt: now + windowMs };
      hits.set(key, e);
    }
    e.count++;
    if (e.count > max) {
      return res.status(429).json({
        error: message || 'Demasiadas peticiones. Probá en unos minutos.',
        errorKey: 'errors.rateLimited',
      });
    }
    next();
  };
}

module.exports = { makeRateLimit };
