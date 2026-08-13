'use strict';

/**
 * WebSocket event broadcaster.
 * Attaches a WS server to the shared HTTP server and exposes
 * broadcast() so any module can push events to all connected clients.
 */

const WebSocket = require('ws');

let wss = null;

function setupWebSocket(httpServer) {
  wss = new WebSocket.Server({ server: httpServer, path: '/ws' });

  wss.on('connection', (socket, req) => {
    const ip = req.socket.remoteAddress;
    console.log(`[WS] Client connected from ${ip}`);

    // Send the current serial connection state on initial connect
    const { serialService } = require('../services/serialService');
    socket.send(JSON.stringify({
      type: 'init',
      connected: serialService.isConnected(),
      port: serialService.currentPort,
    }));

    socket.on('close', () => {
      console.log(`[WS] Client disconnected from ${ip}`);
    });

    socket.on('error', (err) => {
      console.error('[WS] Socket error:', err.message);
    });
  });

  console.log('[WS] WebSocket server attached');
}

/**
 * Broadcast a JSON event to all connected WS clients.
 * @param {object} payload
 */
function broadcast(payload) {
  if (!wss) return;
  const data = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

module.exports = { setupWebSocket, broadcast };
