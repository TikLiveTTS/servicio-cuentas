'use strict';

const fs = require('fs');
const path = require('path');

const TEMPLATE_PATH = path.join(__dirname, 'templates', 'reset-password.html');

function plantillaReset(code) {
  const html = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  return html.replaceAll('{{CODE}}', code);
}

module.exports = { plantillaReset };
