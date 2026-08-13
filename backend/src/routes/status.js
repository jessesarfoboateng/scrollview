'use strict';

const router = require('express').Router();
const { serialService } = require('../services/serialService');

function requireConnected(req, res, next) {
  if (!serialService.isConnected()) {
    return res.status(503).json({ ok: false, error: 'NOT_CONNECTED' });
  }
  next();
}

/**
 * GET /api/status
 * Sends STATUS to the Arduino and returns parsed JSON.
 */
router.get('/', requireConnected, async (req, res) => {
  try {
    const data = await serialService.getStatus();
    res.json({ ok: true, status: data });
  } catch (err) {
    const isTimeout = err.message === 'TIMEOUT';
    res.status(isTimeout ? 504 : 500).json({ ok: false, error: isTimeout ? 'TIMEOUT' : err.message });
  }
});

module.exports = router;
