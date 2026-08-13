'use strict';

/**
 * serialService.js
 *
 * Owns the SerialPort connection to the HC-05/HC-06 Bluetooth virtual COM port.
 * Exposes an EventEmitter interface so routes and WS events can subscribe.
 *
 * Events emitted:
 *   'connected'     — port opened and Arduino confirmed PING
 *   'disconnected'  — port closed or link dropped
 *   'ready'         — Arduino sent READY (boot/reset event)
 *   'status'        — parsed STATUS response  { data: {...} }
 *   'messages'      — updated messages array  { messages: [...] }
 *   'log'           — raw serial log line     { direction: '>' | '<', line: string }
 *   'error'         — serial error            { message: string }
 */

const { EventEmitter } = require('events');
const { SerialPort }   = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const { commands, parseLine } = require('../protocol/commands');
const MockArduino = require('./mockArduino');

const TIMEOUT_MS     = parseInt(process.env.COMMAND_TIMEOUT_MS  || '2000',  10);
const MAX_RETRIES    = parseInt(process.env.MAX_RETRY_ATTEMPTS   || '3',     10);
const RETRY_DELAY_MS = parseInt(process.env.RETRY_DELAY_MS       || '1500',  10);
const BAUD           = parseInt(process.env.SERIAL_BAUD          || '9600',  10);

class SerialService extends EventEmitter {
  constructor() {
    super();
    this.port        = null;   // SerialPort instance
    this.parser      = null;   // ReadlineParser
    this.currentPort = null;   // port path string (e.g. 'COM7')
    this._connected  = false;
    this._cmdQueue   = [];     // pending { cmd, resolve, reject, timer }
    this._listBuf    = null;   // accumulates LIST responses
    this._retryCount = 0;
    this._retryTimer = null;
    this._reconnecting = false;
    this.mockBoard   = null;   // MockArduino instance
  }

  isConnected() { return this._connected; }

  // ── List available serial ports ──────────────────────────
  async listPorts() {
    try {
      return await SerialPort.list();
    } catch (e) {
      console.warn('[Serial] Hardware port scan not supported on this host environment:', e.message);
      return [];
    }
  }

  // ── Connect to a Bluetooth COM port ─────────────────────
  async connect(portPath) {
    if (this._connected) {
      await this.disconnect();
    }
    this.currentPort  = portPath;
    this._retryCount  = 0;
    this._reconnecting = false;

    if (portPath === 'MOCK_PORT') {
      this.mockBoard = new MockArduino();
      this._connected = true;
      
      // Simulate physical Arduino connection process asynchronously
      setTimeout(() => {
        this.emit('connected', { port: portPath });
        this._postConnectSync().catch(console.error);
      }, 300);
      
      return { ok: true, port: portPath };
    }

    return this._openPort(portPath);
  }

  _openPort(portPath) {
    return new Promise((resolve, reject) => {
      // Remove listeners from any previous port instance to prevent
      // stale event handlers firing on reconnect attempts
      if (this.port) {
        this.port.removeAllListeners();
        if (this.parser) this.parser.removeAllListeners();
      }

      const sp = new SerialPort({
        path:     portPath,
        baudRate: BAUD,
        autoOpen: false,
      });

      this.port   = sp;
      this.parser = sp.pipe(new ReadlineParser({ delimiter: '\n' }));

      this.parser.on('data', (line) => this._onLine(line.replace(/\r/g, '')));

      sp.on('error', (err) => {
        console.error('[Serial] Error:', err.message);
        this.emit('error', { message: err.message });
        if (this._connected) {
          this._connected = false;
          this._handleDrop();
        }
      });

      sp.on('close', () => {
        console.log('[Serial] Port closed');
        if (this._connected) {
          this._connected = false;
          this.emit('disconnected');
          this._handleDrop();
        }
      });

      sp.open((err) => {
        if (err) {
          console.error('[Serial] Open failed:', err.message);
          return reject(new Error(`Cannot open port ${portPath}: ${err.message}`));
        }
        console.log(`[Serial] Opened ${portPath} @ ${BAUD} baud`);

        // Ping the Arduino to confirm communication
        setTimeout(() => {
          this._sendRaw(commands.PING())
            .then((resp) => {
              if (resp && resp.type === 'OK') {
                this._connected  = true;
                this._retryCount = 0;
                this.emit('connected', { port: portPath });
                // Immediately pull status + messages
                this._postConnectSync().catch(console.error);
                resolve({ ok: true, port: portPath });
              } else {
                sp.close();
                reject(new Error('Arduino did not respond to PING'));
              }
            })
            .catch((e) => {
              sp.close();
              reject(new Error('Arduino PING timeout: ' + e.message));
            });
        }, 500); // give Bluetooth link 500ms to stabilise
      });
    });
  }

  async _postConnectSync() {
    try {
      const status = await this.getStatus();
      if (status) this.emit('status', { data: status });
      const msgs = await this.listMessages();
      if (msgs) this.emit('messages', { messages: msgs });
    } catch (e) {
      console.error('[Serial] Post-connect sync error:', e.message);
    }
  }

  // ── Disconnect ───────────────────────────────────────────
  disconnect() {
    clearTimeout(this._retryTimer);
    this._reconnecting = false;
    this._connected    = false;
    this._drainQueue('DISCONNECTED');
    this.mockBoard     = null;
    return new Promise((resolve) => {
      if (this.port && this.port.isOpen) {
        this.port.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  // ── Auto-retry on Bluetooth drop ─────────────────────────
  _handleDrop() {
    this._drainQueue('CONNECTION_LOST');
    if (!this.currentPort || this._reconnecting) return;
    if (this._retryCount >= MAX_RETRIES) {
      console.log('[Serial] Max retries reached. Staying disconnected.');
      this.emit('disconnected');
      this._retryCount = 0; // reset so user can manually reconnect later
      return;
    }
    this._reconnecting = true;
    this._retryCount++;
    console.log(`[Serial] Reconnect attempt ${this._retryCount}/${MAX_RETRIES} in ${RETRY_DELAY_MS}ms…`);
    this.emit('reconnecting', { attempt: this._retryCount, max: MAX_RETRIES });

    this._retryTimer = setTimeout(async () => {
      this._reconnecting = false;
      try {
        await this._openPort(this.currentPort);
        this._retryCount = 0; // success — reset counter
        // 'connected' already emitted by _openPort
      } catch (e) {
        console.error('[Serial] Reconnect failed:', e.message);
        this._handleDrop();
      }
    }, RETRY_DELAY_MS);
  }

  // ── Write a raw command line (no queue) ─────────────────
  _writeRaw(cmd) {
    return new Promise((resolve, reject) => {
      if (!this.port || !this.port.isOpen) {
        return reject(new Error('Port not open'));
      }
      const line = cmd + '\n';
      this.emit('log', { direction: '>', line: cmd });
      this.port.write(line, (err) => {
        if (err) return reject(err);
        this.port.drain(resolve);
      });
    });
  }

  // ── Send command and wait for one non-LIST response ─────
  _sendRaw(cmd) {
    if (this.currentPort === 'MOCK_PORT' && this.mockBoard) {
      this.emit('log', { direction: '>', line: cmd });
      return new Promise((resolve) => {
        setTimeout(() => {
          const respLine = this.mockBoard.handleCommand(cmd);
          this.emit('log', { direction: '<', line: respLine });
          const parsed = parseLine(respLine);
          
          // Emit events like the real parser to trigger WS broadcast updates
          if (parsed.type === 'STATUS') {
            this.emit('status', { data: parsed.data });
          }
          resolve(parsed);
        }, 50);
      });
    }

    return new Promise((resolve, reject) => {
      const entry = { cmd, resolve, reject, timer: null };

      const timer = setTimeout(() => {
        this._cmdQueue = this._cmdQueue.filter(q => q !== entry);
        reject(new Error('TIMEOUT'));
      }, TIMEOUT_MS);

      entry.timer = timer;
      this._cmdQueue.push(entry);

      this._writeRaw(cmd).catch((e) => {
        clearTimeout(timer);
        // Remove this specific entry (not necessarily head of queue)
        this._cmdQueue = this._cmdQueue.filter(q => q !== entry);
        reject(e);
      });
    });
  }

  // ── Send command and wait for LIST accumulation ──────────
  _sendList(cmd) {
    if (this.currentPort === 'MOCK_PORT' && this.mockBoard) {
      this.emit('log', { direction: '>', line: cmd });
      return new Promise((resolve) => {
        setTimeout(() => {
          const respList = this.mockBoard.handleCommand(cmd); // returns array of strings
          const items = [];
          respList.forEach(line => {
            this.emit('log', { direction: '<', line });
            const parsed = parseLine(line);
            if (parsed.type === 'LIST_ITEM') {
              items.push({ id: parsed.id, text: parsed.text });
            }
          });
          resolve(items);
        }, 50);
      });
    }

    return new Promise((resolve, reject) => {
      this._listBuf = [];

      const timer = setTimeout(() => {
        this._listBuf = null;
        reject(new Error('TIMEOUT'));
      }, TIMEOUT_MS * 5);

      const onEnd = () => {
        clearTimeout(timer);
        resolve(this._listBuf || []);
        this._listBuf = null;
        this.removeListener('_list_end', onEnd);
      };
      this.once('_list_end', onEnd);
      this._writeRaw(cmd).catch((e) => {
        clearTimeout(timer);
        this._listBuf = null;
        reject(e);
      });
    });
  }

  // ── Incoming line dispatcher ─────────────────────────────
  _onLine(raw) {
    if (!raw || raw.trim() === '') return;
    const line = raw.trim();
    this.emit('log', { direction: '<', line });
    console.log('[Serial RX]', line);

    const parsed = parseLine(line);
    if (!parsed) return;

    switch (parsed.type) {
      case 'READY':
        this._connected = true;
        this.emit('ready');
        this._postConnectSync().catch(console.error);
        break;

      case 'LIST_ITEM':
        if (this._listBuf !== null) {
          this._listBuf.push({ id: parsed.id, text: parsed.text });
        }
        break;

      case 'END_LIST':
        this.emit('_list_end');
        break;

      case 'STATUS':
        // If there's a queued command waiting, resolve it
        if (this._cmdQueue.length > 0) {
          const { resolve, timer } = this._cmdQueue.shift();
          clearTimeout(timer);
          resolve(parsed);
        }
        this.emit('status', { data: parsed.data });
        break;

      case 'OK':
      case 'ERROR':
        if (this._cmdQueue.length > 0) {
          const { resolve, reject, timer } = this._cmdQueue.shift();
          clearTimeout(timer);
          if (parsed.type === 'OK') resolve(parsed);
          else reject(new Error(parsed.code));
        }
        break;

      default:
        break;
    }
  }

  // ── Drain pending queue on disconnection ─────────────────
  _drainQueue(reason) {
    this._cmdQueue.forEach(({ reject, timer }) => {
      clearTimeout(timer);
      reject(new Error(reason));
    });
    this._cmdQueue = [];
    this._listBuf  = null;
  }

  // ── Public API ───────────────────────────────────────────

  async sendCommand(cmd) {
    return this._sendRaw(cmd);
  }

  async ping() {
    return this._sendRaw(commands.PING());
  }

  async getStatus() {
    const resp = await this._sendRaw(commands.STATUS());
    return resp.data || null;
  }

  async listMessages() {
    const items = await this._sendList(commands.LIST());
    return items;
  }

  async addMessage(id, text) {
    return this._sendRaw(commands.ADD(id, text));
  }

  async editMessage(id, text) {
    return this._sendRaw(commands.EDIT(id, text));
  }

  async deleteMessage(id) {
    return this._sendRaw(commands.DELETE(id));
  }

  async showMessage(id) {
    return this._sendRaw(commands.SHOW(id));
  }

  async clearMessages() {
    return this._sendRaw(commands.CLEAR());
  }

  async setSpeed(value) {
    return this._sendRaw(commands.SPEED(value));
  }

  async setMode(mode) {
    return this._sendRaw(commands.MODE(mode));
  }
}

// Singleton
const serialService = new SerialService();

// Forward log events to WS broadcast
serialService.on('log', ({ direction, line }) => {
  const { broadcast } = require('../ws/events');
  broadcast({ type: 'log', direction, line, ts: Date.now() });
});

serialService.on('connected', ({ port }) => {
  const { broadcast } = require('../ws/events');
  broadcast({ type: 'connected', port });
});

serialService.on('disconnected', () => {
  const { broadcast } = require('../ws/events');
  broadcast({ type: 'disconnected' });
});

serialService.on('reconnecting', (info) => {
  const { broadcast } = require('../ws/events');
  broadcast({ type: 'reconnecting', ...info });
});

serialService.on('ready', () => {
  const { broadcast } = require('../ws/events');
  broadcast({ type: 'ready' });
});

serialService.on('status', ({ data }) => {
  const { broadcast } = require('../ws/events');
  broadcast({ type: 'status', data });
});

serialService.on('messages', ({ messages }) => {
  const { broadcast } = require('../ws/events');
  broadcast({ type: 'messages', messages });
});

module.exports = { serialService };
