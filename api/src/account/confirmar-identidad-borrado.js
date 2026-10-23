'use strict';

const { buscarPasswordHash } = require('../queries/buscar-password-hash');
const { verificarPassword } = require('../auth/verificar-password');
const { intercambiarCodeGoogle } = require('../auth/google');
const { buscarIdentidadUsuario } = require('../queries/buscar-identidad-usuario');

// Confirma que quien pide borrar la cuenta es realmente su dueno: con
// password si la tiene, o re-autenticando con Google si la cuenta nacio sin
// password (password_hash NULL, no hay con que mas confirmar). Devuelve
// { ok: true } o { ok: false, status, errorKey, error } listo para fail().
async function confirmarIdentidadBorrado(userId, body) {
  if (typeof body.password === 'string' && body.password) {
    const hash = await buscarPasswordHash(userId);
    if (!hash) return falla(401, 'errors.unauthorized', 'Usuario no encontrado');
    if (!(await verificarPassword(body.password, hash))) {
      return falla(403, 'errors.wrongPassword', 'Contrasena incorrecta');
    }
    return { ok: true };
  }

  if (body.code && body.codeVerifier && body.redirectUri) {
    let perfil;
    try {
      perfil = await intercambiarCodeGoogle({
        code: body.code,
        codeVerifier: body.codeVerifier,
        redirectUri: body.redirectUri,
      });
    } catch (err) {
      if (err.code === 'google_no_configurado') {
        return falla(501, 'errors.notImplemented', 'Login con Google no configurado');
      }
      if (err.code === 'google_redirect_invalido' || err.code === 'google_token_invalido') {
        return falla(400, 'errors.invalidGoogleToken', 'No se pudo validar el login de Google');
      }
      throw err;
    }
    const propia = await buscarIdentidadUsuario(userId, 'google');
    if (!propia || propia.provider_user_id !== perfil.sub) {
      return falla(403, 'errors.wrongPassword', 'Esa cuenta de Google no es la vinculada a este usuario');
    }
    return { ok: true };
  }

  return falla(400, 'errors.invalidBody', 'Falta password o la confirmacion con Google');
}

function falla(status, errorKey, error) {
  return { ok: false, status, errorKey, error };
}

module.exports = { confirmarIdentidadBorrado };
