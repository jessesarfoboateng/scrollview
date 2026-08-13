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
    const ports = await serialService.listPorts();
    res.json({ ok: true, ports });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
