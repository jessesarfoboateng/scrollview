'use strict';

/**
 * Message model — mirrors the Arduino EEPROM structure.
 * Used by the backend as the in-memory representation of a stored message.
 */

class Message {
  /**
   * @param {number} id   - 1-based sequential ID (position in active list)
   * @param {string} text - Message text (max 60 chars)
   */
  constructor(id, text) {
    this.id   = id;
    this.text = text;
  }

  toJSON() {
    return { id: this.id, text: this.text };
  }
}

module.exports = { Message };
