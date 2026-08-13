'use strict';

const router = require('express').Router();
const { serialService } = require('../services/serialService');

/**
 * GET /api/ports
 * Returns all available serial ports. Once HC-05/06 is paired,
 * the Bluetooth virtual COM port appears here.
 */
router.get('/', async (req, res) => {
  try {
    const list = await serialService.listPorts();
    // Always append a virtual mock port for hardwareless testing
    const ports = [
      { path: 'MOCK_PORT', manufacturer: 'Emulator (Virtual Board)' },
      ...list
    ];
    res.json({ ok: true, ports });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
