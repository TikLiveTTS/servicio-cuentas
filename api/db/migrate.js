'use strict';

// Runner de migraciones idempotente. Corre al arrancar la API, antes de
// escuchar en el puerto. Cada .sql de migrations/ se aplica una sola vez y
// queda anotado en <schema>.schema_migrations. Mismo patrón que telemetria-tts.
//
// Rollback: los .sql inversos viven en db/rollback/ con el mismo nombre. NO se
// corren solos; se aplican a mano si hay que revertir:
//   psql "$POSTGRES_URL" -v ON_ERROR_STOP=1 -c 'SET search_path TO cuentas' \
//        -f api/db/rollback/00X_*.down.sql

const fs = require('fs');
const path = require('path');
const { pool } = require('../src/db');
const config = require('../src/config');

const DIR = path.join(__dirname, 'migrations');

async function migrate() {
  const schema = config.dbSchema;

  await pool.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  await pool.query(`SET search_path TO "${schema}"`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "${schema}".schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const { rows } = await pool.query(`SELECT filename FROM "${schema}".schema_migrations`);
  const applied = new Set(rows.map((r) => r.filename));

  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
  let ran = 0;

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(DIR, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL search_path TO "${schema}"`);
      await client.query(sql);
      await client.query(
        `INSERT INTO "${schema}".schema_migrations (filename) VALUES ($1)`,
        [file]
      );
      await client.query('COMMIT');
      console.log(`[migrate] aplicada ${file}`);
      ran++;
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`migracion ${file} fallo: ${err.message}`);
    } finally {
      client.release();
    }
  }

  console.log(ran === 0 ? '[migrate] sin cambios' : `[migrate] ${ran} migracion(es) aplicadas`);
}

module.exports = { migrate };

if (require.main === module) {
  migrate()
    .then(() => pool.end())
    .catch((err) => { console.error(err.message); process.exit(1); });
}
