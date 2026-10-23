'use strict';

const { query } = require('../db');

// Marca que el avatar/banner cambio recien, para el cache-busting de
// url-imagen.js. No guarda ninguna URL.
async function tocarAvatar(userId) {
  await query(`UPDATE users SET avatar_actualizado_at = now() WHERE id = $1`, [userId]);
}

async function tocarBanner(userId) {
  await query(`UPDATE users SET banner_actualizado_at = now() WHERE id = $1`, [userId]);
}

module.exports = { tocarAvatar, tocarBanner };
