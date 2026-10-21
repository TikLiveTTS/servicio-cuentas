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
  polarProductIdSinPromos: opt('POLAR_PRODUCT_ID_SIN_PROMOS', ''),
  polarProductIdProMensual: opt('POLAR_PRODUCT_ID_PRO_MENSUAL', ''),
  polarProductIdSinPromosMensual: opt('POLAR_PRODUCT_ID_SIN_PROMOS_MENSUAL', ''),

  // Google OAuth: opcional para arrancar, igual que Polar. Las rutas que lo
  // necesitan (/api/auth/google, /api/account/link/google) responden 501
  // explicito si falta.
  googleClientId: opt('GOOGLE_CLIENT_ID', ''),
  googleClientSecret: opt('GOOGLE_CLIENT_SECRET', ''),

  // Cloudinary (avatar/banner de perfil): opcional para arrancar, igual que
  // Google/Polar. Las rutas de firma responden 501 explicito si falta.
  cloudinaryCloudName: opt('CLOUDINARY_CLOUD_NAME', ''),
  cloudinaryApiKey: opt('CLOUDINARY_API_KEY', ''),
  cloudinaryApiSecret: opt('CLOUDINARY_API_SECRET', ''),

  // Vincular Twitch/Kick (Fase 1): opcional para arrancar, igual que el
  // resto. Las rutas de vinculacion responden 501 explicito si falta
  // cualquiera de estas.
  twitchClientId: opt('TWITCH_CLIENT_ID', ''),
  twitchClientSecret: opt('TWITCH_CLIENT_SECRET', ''),
  // Secreto elegido por nosotros (no lo da Twitch) para firmar/verificar los
  // webhooks de EventSub. Mismo valor que se manda al crear la suscripcion.
  twitchWebhookSecret: opt('TWITCH_WEBHOOK_SECRET', ''),
  kickClientId: opt('KICK_CLIENT_ID', ''),
  kickClientSecret: opt('KICK_CLIENT_SECRET', ''),
  // 64 hex (openssl rand -hex 32) — clave AES-256 para cifrar los tokens de
  // Twitch/Kick guardados. Sin esto no se puede vincular nada (no hay forma
  // segura de guardar el token), pero el resto del servicio arranca igual.
  tokensEncryptionKey: opt('TOKENS_ENCRYPTION_KEY', ''),

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

// Si esta puesta tiene que ser una clave AES-256 valida (32 bytes = 64 hex).
// Vacia esta bien (Fase 1 de Twitch/Kick responde 501 sin romper el arranque).
if (config.tokensEncryptionKey && !/^[0-9a-f]{64}$/i.test(config.tokensEncryptionKey)) {
  console.error('[config] TOKENS_ENCRYPTION_KEY invalida (debe ser 64 caracteres hex, openssl rand -hex 32)');
  process.exit(1);
}

module.exports = config;
