'use strict';

const express = require('express');
const { query } = require('../db');

const router = express.Router();

// Sin auth. Lo usa el healthcheck de Coolify/Caddy.
router.get('/api/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ ok: true });
  } catch (_) {
    res.status(503).json({ ok: false, error: 'db no disponible', errorKey: 'errors.notReady' });
  }
});

module.exports = router;
