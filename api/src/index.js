'use strict';

const express = require('express');
const helmet = require('helmet');

const config = require('./config');
const { pool, waitForDb } = require('./db');
const { migrate } = require('../db/migrate');
const jobs = require('./jobs/reconciliar');
const { iniciarServidorRealtime } = require('./realtime/servidor');

const healthRoutes = require('./routes/health');
const registerRoutes = require('./routes/register');
const loginRoutes = require('./routes/login');
const authGoogleRoutes = require('./routes/auth-google');
const nicknameRoutes = require('./routes/nickname');
const forgotPasswordRoutes = require('./routes/forgot-password');
const logoutRoutes = require('./routes/logout');
const sessionRoutes = require('./routes/session');
const entitlementsRoutes = require('./routes/entitlements');
const accountRoutes = require('./routes/account');
const avatarBannerRoutes = require('./routes/avatar-banner');
const plataformasRoutes = require('./routes/plataformas');
const checkoutRoutes = require('./routes/checkout');
const subscriptionRoutes = require('./routes/subscription');
const cambiarIntervaloRoutes = require('./routes/cambiar-intervalo');
const chatRoutes = require('./routes/chat');
const webhookRoutes = require('./routes/webhook-polar');
const webhookTwitchRoutes = require('./routes/webhook-twitch');
const webhookKickRoutes = require('./routes/webhook-kick');

const app = express();
app.set('trust proxy', config.trustProxy);
app.disable('x-powered-by');
app.use(helmet());

// CORS: la app Electron llama desde origin 'null' (file://) o sin Origin.
app.use((req, res, next) => {
  const origin = req.get('origin');
  const allow =
    config.publicOrigin.includes('*') ||
    origin === 'null' ||
    !origin ||
    config.publicOrigin.includes(origin);
  if (allow && origin) res.set('Access-Control-Allow-Origin', origin);
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Los webhooks necesitan el body raw -> se montan ANTES del express.json().
app.use('/api', webhookRoutes);
app.use('/api', webhookTwitchRoutes);
app.use('/api', webhookKickRoutes);

app.use(express.json({ limit: 64 * 1024 }));

app.use(healthRoutes);
app.use('/api/auth', registerRoutes);
app.use('/api/auth', loginRoutes);
app.use('/api/auth', authGoogleRoutes);
app.use('/api/auth', nicknameRoutes);
app.use('/api/auth', forgotPasswordRoutes);
app.use('/api/auth', logoutRoutes);
app.use('/api', sessionRoutes);
app.use('/api', entitlementsRoutes);
app.use('/api', accountRoutes);
app.use('/api', avatarBannerRoutes);
app.use('/api', plataformasRoutes);
app.use('/api', checkoutRoutes);
app.use('/api', subscriptionRoutes);
app.use('/api', cambiarIntervaloRoutes);
app.use('/api', chatRoutes);

// 404 JSON.
app.use((req, res) => res.status(404).json({ error: 'No encontrado', errorKey: 'errors.notFound' }));

// Handler de error final: nunca filtra el stack al cliente.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[error]', err.stack || err.message);
  res.status(500).json({ error: 'Error interno', errorKey: 'errors.internal' });
});

async function main() {
  await waitForDb();
  await migrate();
  jobs.start();
  const httpServer = app.listen(config.port, () => {
    console.log(`[servicio-cuentas] escuchando en :${config.port} (schema ${config.dbSchema})`);
  });
  iniciarServidorRealtime(httpServer);
}

process.on('uncaughtException', (err) => console.error('[uncaught]', err.stack || err));
process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));
process.on('SIGTERM', () => pool.end().then(() => process.exit(0)));

main().catch((err) => {
  console.error('[fatal] no se pudo arrancar:', err.message);
  process.exit(1);
});

module.exports = app;
