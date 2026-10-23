'use strict';

const express = require('express');
const crypto = require('crypto');
const { makeRateLimit } = require('../middleware/rate-limit');
const { requireFields, isEmail, isResetCode } = require('../middleware/validate');
const { fail, wrap } = require('../lib/errores');
const { query } = require('../db');
const { buscarUsuarioPorEmail } = require('../queries/buscar-usuario-por-email');
const { conPepper, hashPassword } = require('../auth/hash-password');
const { invalidarSesionesDeUsuario } = require('../queries/invalidar-sesion');
const { enviarEmail, credencialesCompletas } = require('../email/enviar-email');
const { plantillaReset } = require('../email/plantilla-reset');

const router = express.Router();

// Mismo criterio anti-enumeracion/anti-fuerza-bruta que login.js: limite por
// IP + limite por email, y la respuesta de /forgot-password es siempre
// generica, exista o no el email.
const limitIp = makeRateLimit({ max: 5, windowMs: 15 * 60 * 1000 });
const limitPorEmail = makeRateLimit({
  max: 3,
  windowMs: 15 * 60 * 1000,
  keyFn: (req) => String((req.body || {}).email || '').trim().toLowerCase(),
});
const limitReset = makeRateLimit({ max: 10, windowMs: 15 * 60 * 1000 });

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_INTENTOS = 5;

function generarCodigo() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

router.post('/forgot-password', limitIp, limitPorEmail, requireFields('email'), wrap(async (req, res) => {
  const email = String(req.body.email).trim();
  if (!isEmail(email)) return fail(res, 400, 'errors.invalidBody', 'Email invalido');
  if (!credencialesCompletas()) return fail(res, 501, 'errors.emailNoConfigurado', 'Envio de email no configurado');

  const user = await buscarUsuarioPorEmail(email);
  if (user) {
    const codigo = generarCodigo();
    // Un solo codigo vivo por usuario: pedir uno nuevo invalida el anterior.
    await query(`DELETE FROM password_reset_codes WHERE user_id = $1`, [user.id]);
    await query(
      `INSERT INTO password_reset_codes (user_id, code_hash, expires_at) VALUES ($1, $2, $3)`,
      [user.id, conPepper(codigo), new Date(Date.now() + CODE_TTL_MS)]
    );
    // No se espera el envio para responder: si Resend tarda/falla no hay que
    // filtrar eso al cliente (revelaria que el email existe). Fallo real
    // queda en logs del server.
    enviarEmail({
      to: email,
      subject: 'Tu código de recuperación · TikLive TTS',
      html: plantillaReset(codigo),
    }).catch((err) => console.error('[forgot-password] fallo el envio de email:', err.message));
  }

  // Respuesta identica exista o no el usuario -> no revela si un email esta registrado.
  res.json({ ok: true });
}));

router.post('/reset-password', limitIp, limitReset, requireFields('email', 'code', 'newPassword'), wrap(async (req, res) => {
  const email = String(req.body.email).trim();
  const code = String(req.body.code).trim();
  const newPassword = String(req.body.newPassword);

  if (!isResetCode(code)) return fail(res, 400, 'errors.invalidResetCode', 'Codigo invalido o vencido');
  if (newPassword.length < 8) return fail(res, 400, 'errors.weakPassword', 'La contrasena debe tener al menos 8 caracteres');

  const user = await buscarUsuarioPorEmail(email);
  if (!user) return fail(res, 400, 'errors.invalidResetCode', 'Codigo invalido o vencido');

  const { rows } = await query(
    `SELECT id, code_hash, expires_at, intentos FROM password_reset_codes WHERE user_id = $1`,
    [user.id]
  );
  const registro = rows[0];
  if (!registro || new Date(registro.expires_at) < new Date() || registro.intentos >= MAX_INTENTOS) {
    return fail(res, 400, 'errors.invalidResetCode', 'Codigo invalido o vencido');
  }

  const hashIngresado = conPepper(code);
  const coincide = crypto.timingSafeEqual(Buffer.from(registro.code_hash), Buffer.from(hashIngresado));

  if (!coincide) {
    await query(`UPDATE password_reset_codes SET intentos = intentos + 1 WHERE id = $1`, [registro.id]);
    return fail(res, 400, 'errors.invalidResetCode', 'Codigo invalido o vencido');
  }

  const passwordHash = await hashPassword(newPassword);
  await query(`UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`, [user.id, passwordHash]);
  await query(`DELETE FROM password_reset_codes WHERE user_id = $1`, [user.id]);
  // Cambio de contraseña = se cierran todas las sesiones existentes (mismo
  // criterio que un cambio de plan/sospecha de robo, ver invalidar-sesion.js).
  await invalidarSesionesDeUsuario(user.id);

  res.json({ ok: true });
}));

module.exports = router;
