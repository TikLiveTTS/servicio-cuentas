#!/usr/bin/env node
'use strict';

// Precios de los productos de pago en Polar PRODUCCION (https://api.polar.sh/v1).
//
//   node scripts/polar-precios.js crear-test            crea Pro y Sin Promos a 1 USD si no existen
//   node scripts/polar-precios.js restaurar             deja cada producto en su precio original
//   node scripts/polar-precios.js webhook              crea el webhook de la organizacion (usa POLAR_WEBHOOK_SECRET)
//   node scripts/polar-precios.js checkout-test         crea una checkout session por producto y muestra la URL (no cobra)
//   ... --apply                                         sin esto es dry-run (solo lee, no escribe)
//
// Entorno: POLAR_API_KEY (organization access token, NUNCA se imprime).
// Para `restaurar` y `checkout-test`: POLAR_PRODUCT_ID_PRO_ANUAL y POLAR_PRODUCT_ID_SIN_PROMOS.
// Para `webhook`: POLAR_WEBHOOK_SECRET (formato polar_whs_<>=32 chars; el mismo valor va a Coolify).
// Al final siempre verifica por API que el precio quedo como se esperaba.

const BASE = 'https://api.polar.sh/v1';
const KEY = process.env.POLAR_API_KEY;

// centavos USD, anual. Pro: migracion 003; Sin Promos: migracion 005.
const PRODUCTOS = {
  pro: { env: 'POLAR_PRODUCT_ID_PRO_ANUAL', nombre: 'Pro', original: 8500, descripcion: 'TikLiveTTS Pro — suscripción anual' },
  'sin-promos': { env: 'POLAR_PRODUCT_ID_SIN_PROMOS', nombre: 'Sin Promos', original: 2500, descripcion: 'TikLiveTTS Sin Promos — suscripción anual' },
};
const TEST_CENTAVOS = 100;
const WEBHOOK_URL = 'https://cuentas.tiklivetts.es/api/webhooks/polar';
// Los mismos que RELEVANTES en api/src/routes/webhook-polar.js.
const WEBHOOK_EVENTS = [
  'subscription.created', 'subscription.updated', 'subscription.active', 'subscription.canceled',
  'subscription.revoked', 'subscription.uncanceled', 'subscription.past_due',
];

async function api(path, method = 'GET', body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Polar ${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

const precioDe = (p) => {
  const f = (p.prices || []).find((x) => !x.is_archived && x.amount_type === 'fixed');
  return f ? { monto: f.price_amount, moneda: f.price_currency } : null;
};

async function verificar(id, esperado) {
  const p = await api(`/products/${id}`);
  const pr = precioDe(p);
  const ok = pr && pr.monto === esperado && pr.moneda === 'usd' && p.recurring_interval === 'year';
  console.log(`  verificado ${p.name} (${id}): ${pr ? pr.monto + ' ' + pr.moneda : 'sin precio fijo'} ${p.recurring_interval} -> ${ok ? 'OK' : 'MAL'}`);
  return ok;
}

async function main() {
  const [modo, ...flags] = process.argv.slice(2);
  const apply = flags.includes('--apply');
  if (!KEY) throw new Error('falta POLAR_API_KEY en el entorno');
  if (!['crear-test', 'restaurar', 'webhook', 'checkout-test'].includes(modo)) throw new Error('uso: polar-precios.js <crear-test|restaurar|webhook|checkout-test> [--apply]');
  console.log(`modo=${modo} ${apply ? 'APPLY' : 'DRY-RUN'} (token ...${KEY.slice(-4)})`);

  let todoOk = true;
  const ids = {};
  if (modo === 'crear-test') {
    const existentes = (await api('/products/?limit=100&is_archived=false')).items;
    for (const [plan, d] of Object.entries(PRODUCTOS)) {
      const ya = existentes.find((p) => p.name === d.nombre);
      if (ya) { console.log(`- ${d.nombre}: ya existe (${ya.id}), no se toca`); ids[plan] = ya.id; continue; }
      console.log(`- ${d.nombre}: crear year ${TEST_CENTAVOS} usd`);
      if (!apply) continue;
      const p = await api('/products/', 'POST', {
        name: d.nombre,
        description: d.descripcion,
        recurring_interval: 'year',
        prices: [{ amount_type: 'fixed', price_amount: TEST_CENTAVOS, price_currency: 'usd' }],
      });
      ids[plan] = p.id;
    }
    if (apply) for (const [plan, id] of Object.entries(ids)) todoOk = (await verificar(id, TEST_CENTAVOS)) && todoOk;
  } else if (modo === 'webhook') {
    const secret = process.env.POLAR_WEBHOOK_SECRET;
    if (!secret || !secret.startsWith('polar_whs_') || secret.length < 32) throw new Error('POLAR_WEBHOOK_SECRET debe empezar con polar_whs_ y tener >= 32 caracteres');
    const ya = (await api('/webhooks/endpoints?limit=100')).items.find((w) => w.url === WEBHOOK_URL);
    if (ya) { console.log(`- webhook ya existe (${ya.id}), no se toca`); return; }
    console.log(`- crear webhook ${WEBHOOK_URL} eventos=${WEBHOOK_EVENTS.join(',')}`);
    if (!apply) { console.log('dry-run: nada se escribio. Usar --apply.'); return; }
    const w = await api('/webhooks/endpoints', 'POST', { url: WEBHOOK_URL, format: 'raw', secret, events: WEBHOOK_EVENTS });
    console.log(`  creado ${w.id}`);
    return;
  } else if (modo === 'checkout-test') {
    for (const d of Object.values(PRODUCTOS)) {
      const id = process.env[d.env];
      if (!id) throw new Error(`falta ${d.env}`);
      console.log(`- ${d.nombre} (${id}): crear checkout session (no cobra hasta que alguien pague)`);
      if (!apply) continue;
      const c = await api('/checkouts', 'POST', { products: [id] });
      console.log(`  ${c.url}`);
    }
    if (!apply) console.log('dry-run: nada se escribio. Usar --apply.');
    return;
  } else {
    for (const [plan, d] of Object.entries(PRODUCTOS)) {
      const id = process.env[d.env];
      if (!id) throw new Error(`falta ${d.env}`);
      const p = await api(`/products/${id}`);
      console.log(`- ${d.nombre} (${id}): ${JSON.stringify(precioDe(p))} -> ${d.original} usd`);
      if (!apply) continue;
      await api(`/products/${id}`, 'PATCH', {
        prices: [{ amount_type: 'fixed', price_amount: d.original, price_currency: 'usd' }],
      });
      todoOk = (await verificar(id, d.original)) && todoOk;
    }
  }
  if (apply) console.log(JSON.stringify(ids));
  if (!todoOk) process.exit(1);
  if (!apply) console.log('dry-run: nada se escribio. Usar --apply.');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
