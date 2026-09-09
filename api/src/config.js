'use strict';

// Lee y valida el entorno. Falla rápido con mensaje claro si falta algo
// obligatorio, en vez de arrancar a medias. Mismo patrón que telemetria-tts.

function required(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    console.error(`[config] falta la variable de entorno obligatoria: ${name}`);
    process.exit(1);
  }
  return String(v).trim();
}

function opt(name, def) {
  const v = process.env[name];
  return v == null || v === '' ? def : String(v).trim();
}

function int(name, def) {
  const n = parseInt(process.env[name], 10);
  return Number.isFinite(n) ? n : def;
}

const config = {
  port: int('PORT', 4000),
  postgresUrl: required('POSTGRES_URL'),
  dbSchema: opt('DB_SCHEMA', 'cuentas'),

  sessionSecret: required('SESSION_SECRET'),
  sessionHours: int('SESSION_HOURS', 720),

  // Polar: opcionales para arrancar. La Fase 1 (auth) no los necesita; las
  // rutas de checkout/webhook fallan explícitas si faltan cuando se las usa.
  polarApiKey: opt('POLAR_API_KEY', ''),
  polarWebhookSecret: opt('POLAR_WEBHOOK_SECRET', ''),
  polarProductIdProAnual: opt('POLAR_PRODUCT_ID_PRO_ANUAL', ''),
  polarEnv: opt('POLAR_ENV', 'test'),

  // Hop count, no booleano: con `true` Express confía en TODO el header
  // X-Forwarded-For (el primer valor, que el cliente controla). `1` = confía
  // solo en el proxy inmediato (Traefik), que es el que agrega el IP real.
  trustProxy: int('TRUST_PROXY', 1),
  // La app Electron llama sin Origin (o 'null') -> eso ya se deja pasar
  // aparte en index.js sin importar esta lista. Hoy no hay ningun consumidor
  // legitimo desde un navegador, asi que el default es "ninguno" en vez de
  // '*' (abierto a cualquier sitio).
  publicOrigin: opt('PUBLIC_ORIGIN', '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  reconcileEveryHours: int('RECONCILE_EVERY_HOURS', 6),
  publicUrl: opt('PUBLIC_URL', 'https://cuentas.tiklivetts.es'),
};

if (config.sessionSecret.length < 16) {
  console.error('[config] SESSION_SECRET demasiado corto (mínimo 16 caracteres)');
  process.exit(1);
}

// El schema va sin comillas en varios lugares: restringir a identificador simple.
if (!/^[a-z_][a-z0-9_]*$/.test(config.dbSchema)) {
  console.error(`[config] DB_SCHEMA inválido: ${config.dbSchema}`);
  process.exit(1);
}

module.exports = config;
