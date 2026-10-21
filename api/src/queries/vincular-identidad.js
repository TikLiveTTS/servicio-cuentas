'use strict';

const { query } = require('../db');

// Vincula una identidad externa (ej. Google) a un usuario. Lanza con code
// 'identidad_tomada' si esa identidad ya esta vinculada a OTRO usuario, o
// 'ya_vinculado' si el mismo usuario ya tiene un proveedor de ese tipo
// (coincida o no con la identidad que se intenta vincular ahora — eso lo
// distingue el llamador).
async function vincularIdentidad({ userId, provider, providerUserId, email }) {
  try {
    const { rows } = await query(
      `INSERT INTO auth_identities (user_id, provider, provider_user_id, email)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [userId, provider, providerUserId, email || null]
    );
    return rows[0];
  } catch (err) {
    if (err.code === '23505' && err.constraint === 'auth_identities_provider_provider_user_id_key') {
      const e = new Error('esa identidad ya esta vinculada a otro usuario');
      e.code = 'identidad_tomada';
      throw e;
    }
    if (err.code === '23505' && err.constraint === 'auth_identities_user_id_provider_key') {
      const e = new Error('el usuario ya tiene un proveedor de ese tipo vinculado');
      e.code = 'ya_vinculado';
      throw e;
    }
    throw err;
  }
}

module.exports = { vincularIdentidad };
