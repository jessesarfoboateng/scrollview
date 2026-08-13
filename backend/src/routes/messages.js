'use strict';

const router = require('express').Router();
const { serialService } = require('../services/serialService');
const { validateText, validateId } = require('../protocol/commands');

function requireConnected(req, res, next) {
  if (!serialService.isConnected()) {
    return res.status(503).json({ ok: false, error: 'NOT_CONNECTED' });
  }
  next();
}

/**
 * GET /api/messages
 * Returns all stored messages from the Arduino.
 */
router.get('/', requireConnected, async (req, res) => {
  try {
    const messages = await serialService.listMessages();
    res.json({ ok: true, messages });
  } catch (err) {
    const isTimeout = err.message === 'TIMEOUT';
    res.status(isTimeout ? 504 : 500).json({ ok: false, error: isTimeout ? 'TIMEOUT' : err.message });
  }
});

/**
 * POST /api/messages
 * Body: { id: 1, text: "Welcome to KNUST" }
 */
router.post('/', requireConnected, async (req, res) => {
  const { id, text } = req.body;
  const idVal = validateId(id);
  if (!idVal.valid) return res.status(400).json({ ok: false, error: idVal.error });
  const txtVal = validateText(text);
  if (!txtVal.valid) return res.status(400).json({ ok: false, error: txtVal.error });
  try {
    await serialService.addMessage(idVal.id, txtVal.text);
    res.json({ ok: true, id: idVal.id, text: txtVal.text });
  } catch (err) {
    const isTimeout = err.message === 'TIMEOUT';
    res.status(isTimeout ? 504 : 500).json({ ok: false, error: isTimeout ? 'TIMEOUT' : err.message });
  }
});

/**
 * PUT /api/messages/:id
 * Body: { text: "New message text" }
 */
router.put('/:id', requireConnected, async (req, res) => {
  const idVal  = validateId(req.params.id);
  if (!idVal.valid) return res.status(400).json({ ok: false, error: idVal.error });
  const txtVal = validateText(req.body.text);
  if (!txtVal.valid) return res.status(400).json({ ok: false, error: txtVal.error });
  try {
    await serialService.editMessage(idVal.id, txtVal.text);
    res.json({ ok: true, id: idVal.id, text: txtVal.text });
  } catch (err) {
    const isTimeout = err.message === 'TIMEOUT';
    res.status(isTimeout ? 504 : 500).json({ ok: false, error: isTimeout ? 'TIMEOUT' : err.message });
  }
});

/**
 * DELETE /api/messages/:id
 */
router.delete('/:id', requireConnected, async (req, res) => {
  const idVal = validateId(req.params.id);
  if (!idVal.valid) return res.status(400).json({ ok: false, error: idVal.error });
  try {
    await serialService.deleteMessage(idVal.id);
    res.json({ ok: true, id: idVal.id });
  } catch (err) {
    const isTimeout = err.message === 'TIMEOUT';
    res.status(isTimeout ? 504 : 500).json({ ok: false, error: isTimeout ? 'TIMEOUT' : err.message });
  }
});

/**
 * POST /api/messages/:id/show
 * Display a specific message on the LED matrix.
 */
router.post('/:id/show', requireConnected, async (req, res) => {
  const idVal = validateId(req.params.id);
  if (!idVal.valid) return res.status(400).json({ ok: false, error: idVal.error });
  try {
    await serialService.showMessage(idVal.id);
    res.json({ ok: true, id: idVal.id });
  } catch (err) {
    const isTimeout = err.message === 'TIMEOUT';
    res.status(isTimeout ? 504 : 500).json({ ok: false, error: isTimeout ? 'TIMEOUT' : err.message });
  }
});

/**
 * DELETE /api/messages  (clear all)
 * IMPORTANT: Frontend must show a confirmation dialog before calling this.
 */
router.delete('/', requireConnected, async (req, res) => {
  try {
    await serialService.clearMessages();
    res.json({ ok: true });
  } catch (err) {
    const isTimeout = err.message === 'TIMEOUT';
    res.status(isTimeout ? 504 : 500).json({ ok: false, error: isTimeout ? 'TIMEOUT' : err.message });
  }
});

module.exports = router;
