#!/usr/bin/env node
/**
 * Production frontend server  (no extra dependencies — only Node.js built-ins)
 *
 * Serves the Vite build output (dist/) on PORT (default 3000) and relays
 * incoming LiqPay callbacks to the local Express backend.
 *
 * Usage:
 *   npm run build          # build the React app first
 *   node server.cjs        # then start this server
 *
 * Environment variables (all optional, shown with defaults):
 *   PORT          = 3000          frontend listening port
 *   BACKEND_HOST  = localhost      backend hostname
 *   BACKEND_PORT  = 5000          backend port
 *
 * Relay table (public path on port 3000 → backend path on port 5000):
 *
 *   POST /liqpay/callback/subscription
 *        → /api/subscriptions/webhook/liqpay
 *
 *   POST /liqpay/callback/order/:restaurantId
 *        → /api/payments/webhook/liqpay/:restaurantId
 */
'use strict';

const http = require('node:http');
const fs   = require('node:fs');
const path = require('node:path');

const PORT         = parseInt(process.env.PORT         || '3000', 10);
const BACKEND_HOST = process.env.BACKEND_HOST          || 'localhost';
const BACKEND_PORT = parseInt(process.env.BACKEND_PORT || '5000', 10);
const DIST         = path.join(__dirname, 'dist');

// Relay table — each entry maps a public path pattern to a backend path
const RELAYS = [
  {
    pattern:     /^\/liqpay\/callback\/subscription$/,
    backendPath: ()      => '/api/subscriptions/webhook/liqpay',
    label:       'subscription',
  },
  {
    pattern:     /^\/liqpay\/callback\/order\/([^/]+)$/,
    backendPath: (match) => `/api/payments/webhook/liqpay/${match[1]}`,
    label:       'order',
  },
];

// ── MIME types for static file serving ───────────────────────────────────────
const MIME = {
  '.html':  'text/html; charset=utf-8',
  '.js':    'application/javascript; charset=utf-8',
  '.mjs':   'application/javascript; charset=utf-8',
  '.css':   'text/css; charset=utf-8',
  '.json':  'application/json',
  '.png':   'image/png',
  '.jpg':   'image/jpeg',
  '.jpeg':  'image/jpeg',
  '.gif':   'image/gif',
  '.webp':  'image/webp',
  '.svg':   'image/svg+xml',
  '.ico':   'image/x-icon',
  '.woff':  'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':   'font/ttf',
  '.txt':   'text/plain',
};

// ── Relay an incoming LiqPay POST to the backend ──────────────────────────────
function relayToBackend(req, res, backendPath, label) {
  const chunks = [];
  req.on('data',  c => chunks.push(c));
  req.on('error', () => { res.statusCode = 200; res.end('OK'); });
  req.on('end',   () => {
    const body = Buffer.concat(chunks);
    const opts = {
      hostname: BACKEND_HOST,
      port:     BACKEND_PORT,
      path:     backendPath,
      method:   'POST',
      headers: {
        'content-type':    req.headers['content-type'] || 'application/x-www-form-urlencoded',
        'content-length':  body.length,
        'x-forwarded-for': req.socket.remoteAddress || '',
        'x-liqpay-relay':  '1',
      },
    };

    const pr = http.request(opts, backendRes => {
      res.statusCode = backendRes.statusCode;
      backendRes.pipe(res);
    });

    pr.on('error', err => {
      console.error(`[liqpay-relay:${label}] backend error:`, err.message);
      res.statusCode = 200;
      res.end('OK');
    });

    pr.write(body);
    pr.end();
  });
}

// ── Static file serving with SPA fallback ────────────────────────────────────
function serveStatic(urlPath, res) {
  const relative = urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, '');
  const filePath  = path.join(DIST, relative);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Unknown path → serve index.html so React Router handles it client-side
      fs.readFile(path.join(DIST, 'index.html'), (e2, html) => {
        if (e2) { res.statusCode = 500; return res.end('Server error'); }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(html);
      });
      return;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME[path.extname(filePath)] || 'application/octet-stream');
    if (path.extname(filePath) !== '.html') {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
    res.end(data);
  });
}

// ── HTTP server ───────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const urlPath = (req.url || '/').split('?')[0];

  // LiqPay callback relay — check POST requests against the relay table
  if (req.method === 'POST') {
    for (const relay of RELAYS) {
      const match = urlPath.match(relay.pattern);
      if (match) {
        const backendPath = relay.backendPath(match);
        console.log(`[liqpay-relay:${relay.label}] ${req.socket.remoteAddress} → ${backendPath}`);
        return relayToBackend(req, res, backendPath, relay.label);
      }
    }
  }

  // Static file serving (GET only)
  if (req.method === 'GET') {
    return serveStatic(urlPath, res);
  }

  res.statusCode = 405;
  res.end('Method Not Allowed');
});

server.listen(PORT, () => {
  console.log(`Frontend server  → http://localhost:${PORT}`);
  for (const relay of RELAYS) {
    console.log(`LiqPay relay     → POST ${relay.pattern.source.replace(/\\/g, '')} → ${BACKEND_HOST}:${BACKEND_PORT}`);
  }
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT',  () => server.close(() => process.exit(0)));
