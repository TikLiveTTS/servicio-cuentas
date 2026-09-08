'use strict';

const { query } = require('../db');

// Devuelve true si el evento es nuevo (y lo registra); false si ya se procesó.
async function marcarEventoWebhook(eventId, tipo) {
  const { rowCount } = await query(
    `INSERT INTO webhook_events (event_id, tipo) VALUES ($1, $2)
     ON CONFLICT (event_id) DO NOTHING`,
    [eventId, tipo || null]
  );
  return rowCount === 1;
}

module.exports = { marcarEventoWebhook };
