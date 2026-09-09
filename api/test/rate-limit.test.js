'use strict';

// makeRateLimit es una funcion pura (req,res,next) -> no hace falta un
// server HTTP real para probarla, un req/res de mentira alcanza.

const { test } = require('node:test');
const assert = require('node:assert');
const { makeRateLimit } = require('../src/middleware/rate-limit');

function mockRes() {
  const res = { statusCode: 200 };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

test('default: keyea por req.ip, bloquea al pasar el max', () => {
  const limit = makeRateLimit({ max: 2, windowMs: 60_000 });
  const req = { ip: '1.1.1.1' };

  let calls = 0;
  const next = () => { calls++; };

  limit(req, mockRes(), next);
  limit(req, mockRes(), next);
  assert.equal(calls, 2, 'los primeros 2 pasan');

  const res3 = mockRes();
  limit(req, res3, next);
  assert.equal(calls, 2, 'el 3ro no llama next()');
  assert.equal(res3.statusCode, 429);
});

test('keyFn custom: dos IPs distintas, mismo email -> bloquea igual', () => {
  const limit = makeRateLimit({
    max: 1,
    windowMs: 60_000,
    keyFn: (req) => String((req.body || {}).email || '').toLowerCase(),
  });

  let calls = 0;
  const next = () => { calls++; };

  limit({ ip: '1.1.1.1', body: { email: 'x@x.com' } }, mockRes(), next);
  assert.equal(calls, 1);

  const res2 = mockRes();
  // IP distinta (simula X-Forwarded-For falsificado) pero mismo email -> igual bloquea.
  limit({ ip: '2.2.2.2', body: { email: 'X@X.com' } }, res2, next);
  assert.equal(calls, 1, 'no llama next(), mismo email normalizado');
  assert.equal(res2.statusCode, 429);
});
