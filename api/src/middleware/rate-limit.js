'use strict';

// Rate limit en memoria por IP. Suficiente para un solo proceso; si algún día
// hay varias réplicas, mover a Postgres o Redis.
function makeRateLimit({ max, windowMs, message }) {
  const hits = new Map(); // ip -> { count, resetAt }

  return function rateLimit(req, res, next) {
    const now = Date.now();
    const ip = req.ip || 'desconocida';
    let e = hits.get(ip);
    if (!e || now > e.resetAt) {
      e = { count: 0, resetAt: now + windowMs };
      hits.set(ip, e);
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
