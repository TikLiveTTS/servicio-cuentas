'use strict';

const fs = require('fs');
const path = require('path');

const TEMPLATE_PATH = path.join(__dirname, 'templates', 'bienvenida-suscripcion.html');

function plantillaBienvenida(nombre) {
  const html = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  return html.replaceAll('{{NOMBRE}}', nombre || 'streamer');
}

module.exports = { plantillaBienvenida };
