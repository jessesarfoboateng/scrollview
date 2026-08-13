'use strict';

require('dotenv').config();
const http    = require('http');
const express = require('express');
const cors    = require('cors');
const { setupWebSocket } = require('./ws/events');
// Import serialService at startup so its singleton event listeners
// (which forward to broadcast()) are registered before any route uses it.
const { serialService } = require('./services/serialService');

const portsRoute      = require('./routes/ports');
const connectionRoute = require('./routes/connection');
const messagesRoute   = require('./routes/messages');
const speedRoute      = require('./routes/speed');
const statusRoute     = require('./routes/status');

const PORT = parseInt(process.env.PORT || '5000', 10);

const app = express();

// ── Middleware ─────────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: false,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ── Health check ───────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    ok: true,
    message: 'ScrollView backend running',
    version: '1.0.0',
    connected: serialService.isConnected(),
    port: serialService.currentPort,
  });
});

// ── API routes ─────────────────────────────────────────────
app.use('/api/ports',      portsRoute);
app.use('/api/connection', connectionRoute);
app.use('/api/messages',   messagesRoute);
app.use('/api/speed',      speedRoute);
app.use('/api/status',     statusRoute);

// ── 404 handler ────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'NOT_FOUND' });
});

// ── Global error handler ───────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[Express Error]', err.message);
  res.status(500).json({ ok: false, error: err.message || 'INTERNAL_ERROR' });
});

// ── HTTP + WebSocket server ────────────────────────────────
const server = http.createServer(app);
setupWebSocket(server);

server.listen(PORT, () => {
  console.log(`[ScrollView Backend] Running on http://localhost:${PORT}`);
  console.log(`[ScrollView Backend] WebSocket on ws://localhost:${PORT}/ws`);
});

// ── Graceful shutdown ──────────────────────────────────────
process.on('SIGINT', async () => {
  console.log('\n[ScrollView Backend] Shutting down…');
  await serialService.disconnect();
  server.close(() => {
    console.log('[ScrollView Backend] Closed.');
    process.exit(0);
  });
});
