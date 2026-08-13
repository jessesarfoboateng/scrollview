'use strict';

const router = require('express').Router();
const { serialService } = require('../services/serialService');
const { validateSpeed } = require('../protocol/commands');

function requireConnected(req, res, next) {
  if (!serialService.isConnected()) {
    return res.status(503).json({ ok: false, error: 'NOT_CONNECTED' });
  }
  next();
}

/**
 * POST /api/speed
 * Body: { speed: 50 }  (1–100)
 */
router.post('/', requireConnected, async (req, res) => {
  const val = validateSpeed(req.body.speed);
  if (!val.valid) return res.status(400).json({ ok: false, error: val.error });
  try {
    await serialService.setSpeed(val.speed);
    res.json({ ok: true, speed: val.speed });
  } catch (err) {
    const isTimeout = err.message === 'TIMEOUT';
    res.status(isTimeout ? 504 : 500).json({ ok: false, error: isTimeout ? 'TIMEOUT' : err.message });
  }
});

/**
 * POST /api/speed/mode
 * Body: { mode: "potentiometer" | "computer" }
 */
router.post('/mode', requireConnected, async (req, res) => {
  const { mode } = req.body;
  if (!mode || !['potentiometer', 'computer'].includes(mode)) {
    return res.status(400).json({ ok: false, error: 'INVALID_MODE' });
  }
  try {
    await serialService.setMode(mode);
    res.json({ ok: true, mode });
  } catch (err) {
    const isTimeout = err.message === 'TIMEOUT';
    res.status(isTimeout ? 504 : 500).json({ ok: false, error: isTimeout ? 'TIMEOUT' : err.message });
  }
});

module.exports = router;
