import { defineConfig } from 'vite';
import react            from '@vitejs/plugin-react';
import http             from 'node:http';

// ─────────────────────────────────────────────────────────────────────────────
// LiqPay callback relay (port 3000 → localhost:5000)
//
// Why this exists:
//   ngrok is only running on port 3000 (the Vite dev/preview server).
//   Port 5000 (Express API) is never publicly exposed.  When LiqPay POSTs a
//   callback to the ngrok URL, this plugin intercepts it at port 3000 and
//   forwards the raw body to the local backend.
//
// Relay table (public path on port 3000 → backend path on port 5000):
//
//   POST /liqpay/callback/subscription
//        → /api/subscriptions/webhook/liqpay
//
//   POST /liqpay/callback/order/:restaurantId
//        → /api/payments/webhook/liqpay/:restaurantId
// ─────────────────────────────────────────────────────────────────────────────

const BACKEND_HOST = 'localhost';
const BACKEND_PORT = 5000;

// Each entry: { pattern: RegExp, backendPath: (match) => string, label: string }
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

function relayToBackend(req, res, backendPath, label) {
  const chunks = [];
  req.on('data',  c  => chunks.push(c));
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
        'x-forwarded-for': req.socket?.remoteAddress ?? '',
        'x-liqpay-relay':  '1',
      },
    };

    const pr = http.request(opts, backendRes => {
      res.statusCode = backendRes.statusCode ?? 200;
      backendRes.pipe(res);
    });

    pr.on('error', err => {
      console.error(`[liqpay-relay:${label}] backend unreachable:`, err.message);
      res.statusCode = 200;
      res.end('OK');
    });

    pr.write(body);
    pr.end();
  });
}

function liqpayRelayPlugin() {
  // Single middleware that checks every POST against the relay table
  const middleware = (req, res, next) => {
    if (req.method !== 'POST') return next();
    const urlPath = (req.url || '').split('?')[0];
    for (const relay of RELAYS) {
      const match = urlPath.match(relay.pattern);
      if (match) {
        return relayToBackend(req, res, relay.backendPath(match), relay.label);
      }
    }
    next();
  };

  return {
    name: 'liqpay-relay',
    configureServer(server)        { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export default defineConfig({
  plugins: [react(), liqpayRelayPlugin()],

  server: {
    port: 3000,
    allowedHosts: ['overcoat-badland-affix.ngrok-free.dev', '.ngrok-free.dev', '.ngrok.io'],
    proxy: {
      '/api': 'http://localhost:5000',
      '/ws': {
        target:          'ws://localhost:5000',
        ws:              true,
        rewriteWsOrigin: true,
      },
    },
  },

  preview: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:5000',
      '/ws': {
        target:          'ws://localhost:5000',
        ws:              true,
        rewriteWsOrigin: true,
      },
    },
  },
});
