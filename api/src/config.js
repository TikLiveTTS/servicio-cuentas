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

function bool(name, def) {
  const v = process.env[name];
  if (v == null || v === '') return def;
  return /^(1|true|yes|on)$/i.test(String(v).trim());
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

  polarApiKey: required('POLAR_API_KEY'),
  polarWebhookSecret: required('POLAR_WEBHOOK_SECRET'),
  polarProductIdProAnual: opt('POLAR_PRODUCT_ID_PRO_ANUAL', ''),
  polarEnv: opt('POLAR_ENV', 'test'),

  trustProxy: bool('TRUST_PROXY', true),
  publicOrigin: opt('PUBLIC_ORIGIN', '*')
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
