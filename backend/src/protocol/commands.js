'use strict';

/**
 * Protocol command builder/parser for the Arduino Bluetooth protocol.
 * All commands are newline-terminated strings.
 */

const MAX_MSG_LEN = 60;

const commands = {
  PING:   () => 'PING',
  STATUS: () => 'STATUS',
  LIST:   () => 'LIST',
  CLEAR:  () => 'CLEAR',

  ADD(id, text) {
    const safe = sanitizeText(text);
    return `ADD|${id}|${safe}`;
  },
  EDIT(id, text) {
    const safe = sanitizeText(text);
    return `EDIT|${id}|${safe}`;
  },
  DELETE: (id) => `DELETE|${id}`,
  SHOW:   (id) => `SHOW|${id}`,
  SPEED:  (val) => `SPEED|${val}`,
  MODE:   (mode) => `MODE|${mode}`,
};

// ── Validators ─────────────────────────────────────────────

function sanitizeText(text) {
  // Strip newlines and pipe characters that would break framing
  return String(text).replace(/[\r\n|]/g, ' ').trim().slice(0, MAX_MSG_LEN);
}

function validateText(text) {
  if (!text || typeof text !== 'string') return { valid: false, error: 'EMPTY_MESSAGE' };
  const clean = sanitizeText(text);
  if (clean.length === 0) return { valid: false, error: 'EMPTY_MESSAGE' };
  if (clean.length > MAX_MSG_LEN) return { valid: false, error: 'MESSAGE_TOO_LONG' };
  return { valid: true, text: clean };
}

function validateId(id) {
  const n = parseInt(id, 10);
  if (isNaN(n) || n < 1) return { valid: false, error: 'INVALID_ID' };
  return { valid: true, id: n };
}

function validateSpeed(value) {
  const n = parseInt(value, 10);
  if (isNaN(n) || n < 1 || n > 100) return { valid: false, error: 'INVALID_SPEED' };
  return { valid: true, speed: n };
}

// ── Response parsers ───────────────────────────────────────

/**
 * Parse a single line from the Arduino into a structured object.
 * Returns null if the line should be silently ignored.
 */
function parseLine(line) {
  if (!line || line.trim() === '') return null;
  const parts = line.trim().split('|');
  const type  = parts[0];

  switch (type) {
    case 'READY':
      return { type: 'READY' };

    case 'OK':
      return { type: 'OK', command: parts[1], id: parts[2] };

    case 'ERROR':
      return { type: 'ERROR', code: parts[1] || 'UNKNOWN_ERROR' };

    case 'LIST':
      return { type: 'LIST_ITEM', id: parseInt(parts[1], 10), text: parts.slice(2).join('|') };

    case 'END':
      return { type: 'END_LIST' };

    case 'STATUS': {
      // STATUS|messages=4|active=2|speed=50|mode=potentiometer
      const obj = {};
      for (let i = 1; i < parts.length; i++) {
        const [k, v] = parts[i].split('=');
        if (k && v !== undefined) obj[k] = isNaN(v) ? v : Number(v);
      }
      return { type: 'STATUS', data: obj };
    }

    default:
      return { type: 'UNKNOWN', raw: line };
  }
}

module.exports = { commands, parseLine, validateText, validateId, validateSpeed, sanitizeText, MAX_MSG_LEN };
