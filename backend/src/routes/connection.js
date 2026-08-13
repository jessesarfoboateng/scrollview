'use strict';

const router = require('express').Router();
const { serialService } = require('../services/serialService');

/**
 * POST /api/connection/connect
 * Body: { port: "COM7" }
 * Opens the Bluetooth virtual serial port and pings the Arduino.
 */
router.post('/connect', async (req, res) => {
  const { port } = req.body;
  if (!port) {
    return res.status(400).json({ ok: false, error: 'PORT_REQUIRED' });
  }
  try {
    const result = await serialService.connect(port);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message,
      hint: 'Check that the Arduino is powered on and HC-05/HC-06 is paired at the OS level.',
    });
  }
});

/**
 * POST /api/connection/disconnect
 * Closes the serial port.
 */
router.post('/disconnect', async (req, res) => {
  try {
    await serialService.disconnect();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/connection/state
 * Returns current connection state.
 */
router.get('/state', (req, res) => {
  res.json({
    ok: true,
    connected: serialService.isConnected(),
    port: serialService.currentPort,
  });
});

module.exports = router;
