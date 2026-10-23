'use strict';

const config = require('../config');

// Reconstruye la URL de una imagen de perfil sin guardar nada: el public_id
// en Cloudinary es siempre "<carpeta>/<userId>" (ver firmar-subida.js), asi
// que la direccion es siempre la misma formula. El "?v=" es cache-busting
// nuestro (no el versionado interno de Cloudinary) para que el cliente no
// muestre una imagen vieja cacheada despues de subir una nueva.
function urlImagen(carpeta, userId, actualizadoAt) {
  if (!config.cloudinaryCloudName || !actualizadoAt) return null;
  const cacheBust = new Date(actualizadoAt).getTime();
  return `https://res.cloudinary.com/${config.cloudinaryCloudName}/image/upload/${carpeta}/${userId}?v=${cacheBust}`;
}

module.exports = { urlImagen };
