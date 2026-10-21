'use strict';

const cloudinary = require('cloudinary').v2;
const config = require('../config');

const FORMATOS_PERMITIDOS = 'png,jpg,jpeg,webp';

function credencialesCompletas() {
  return !!(config.cloudinaryCloudName && config.cloudinaryApiKey && config.cloudinaryApiSecret);
}

// Firma una subida directa a Cloudinary (la app sube el archivo sin pasar
// por este backend) para el public_id dado. Siempre con overwrite=true: cada
// subida nueva pisa la anterior, no se acumulan versiones viejas.
// Lanza con code 'cloudinary_no_configurado' si faltan las credenciales.
function firmarSubida(publicId) {
  if (!credencialesCompletas()) {
    const e = new Error('Cloudinary no configurado (falta CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET)');
    e.code = 'cloudinary_no_configurado';
    throw e;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const paramsAFirmar = {
    timestamp,
    public_id: publicId,
    overwrite: true,
    allowed_formats: FORMATOS_PERMITIDOS,
  };
  const signature = cloudinary.utils.api_sign_request(paramsAFirmar, config.cloudinaryApiSecret);

  return {
    signature,
    timestamp,
    apiKey: config.cloudinaryApiKey,
    cloudName: config.cloudinaryCloudName,
    publicId,
    overwrite: true,
    allowedFormats: FORMATOS_PERMITIDOS,
  };
}

module.exports = { firmarSubida };
