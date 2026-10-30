'use strict';

const config = require('../config');

// Reconstruye la URL de una imagen de perfil sin guardar nada: el public_id
// en Cloudinary es siempre "<carpeta>/<userId>" (ver firmar-subida.js), asi
// que la direccion es siempre la misma formula. El "/v<segundos>/" es el
// cache-busting: como cada subida pisa el mismo public_id, sin el el CDN de
// Cloudinary sigue sirviendo la imagen vieja hasta 30 dias (ignora la
// querystring, un "?v=" no sirve).
function urlImagen(carpeta, userId, actualizadoAt) {
  if (!config.cloudinaryCloudName || !actualizadoAt) return null;
  const version = Math.floor(new Date(actualizadoAt).getTime() / 1000);
  return `https://res.cloudinary.com/${config.cloudinaryCloudName}/image/upload/v${version}/${carpeta}/${userId}`;
}

module.exports = { urlImagen };
