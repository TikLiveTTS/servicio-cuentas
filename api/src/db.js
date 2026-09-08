'use strict';

const { Pool } = require('pg');
const config = require('./config');

// search_path por conexión: todas las queries del servicio operan dentro del
// schema propio sin calificar cada tabla.
const pool = new Pool({
  connectionString: config.postgresUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  options: `-c search_path=${config.dbSchema}`,
});

pool.on('error', (err) => {
  console.error('[db] error en cliente idle:', err.message);
});

function query(text, params) {
  return pool.query(text, params);
}

async function waitForDb(attempts = 30, delayMs = 2000) {
  for (let i = 1; i <= attempts; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      if (i === attempts) throw err;
      console.log(`[db] esperando a Postgres (${i}/${attempts})...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

module.exports = { pool, query, waitForDb };
