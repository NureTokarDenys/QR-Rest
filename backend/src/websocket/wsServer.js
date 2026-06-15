const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');
const { verifyAccess } = require('../config/jwt');
const Session = require('../models/Session');
const { setWss, joinRoom, leaveAllRooms, replayEvents } = require('../services/wsService');
const logger = require('../config/logger');

function initWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });
  setWss(wss);

  wss.on('connection', async (ws, req) => {
    ws.id = uuidv4();
    ws.isAlive = true;

    // Attach protocol handlers immediately — before any async auth — so messages
    // sent right after the handshake are never dropped due to a missing listener.
    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw);
        handleMessage(ws, msg);
      } catch {
        // ignore malformed messages
      }
    });

    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('close', () => {
      leaveAllRooms(ws);
      logger.info('ws_disconnected', { wsId: ws.id });
    });

    // Parse auth from headers AND query params (browser WS API cannot set custom headers)
    const authHeader = req.headers.authorization || '';
    const cookieHeader = req.headers.cookie || '';
    const reqUrl = new URL(req.url, 'http://localhost');
    const queryToken = reqUrl.searchParams.get('token') || '';
    const querySessionToken = reqUrl.searchParams.get('session_token') || '';

    const bearerToken = authHeader.startsWith('Bearer ')
      ? authHeader.replace('Bearer ', '')
      : queryToken;

    const sessionToken = parseCookieToken(cookieHeader) || querySessionToken;

    if (bearerToken) {
      try {
        const payload = verifyAccess(bearerToken);
        ws.userId = payload.sub;
        ws.role = payload.role;
        ws.restaurantId = payload.restaurantId;

        // Auto-join staff rooms based on role.
        // Admins (and root_admins) join EVERY room so any change made by another
        // staff member or by the admin themselves is delivered everywhere they
        // might have the relevant page open.
        if (ws.restaurantId) {
          joinRoom(ws, `restaurant:${ws.restaurantId}`);
          const kitchenRoles = ['cook', 'waiter_cook', 'admin', 'root_admin'];
          const waiterRoles  = ['waiter', 'waiter_cook', 'admin', 'root_admin'];
          if (kitchenRoles.includes(ws.role)) joinRoom(ws, `kitchen:${ws.restaurantId}`);
          if (waiterRoles.includes(ws.role))  joinRoom(ws, `waiter:${ws.restaurantId}`);
        }

        // A logged-in customer may also carry a table session token (sent as session_token
        // query param alongside the bearer token). Join their session/table rooms so they
        // receive DISH_STATUS_UPDATED events even when authenticated with an account.
        if (sessionToken) {
          const session = await Session.findOne({ token: sessionToken, isActive: true });
          if (session && session.expiresAt >= new Date()) {
            ws.sessionToken = sessionToken;
            ws.tableId = session.tableId.toString();
            joinRoom(ws, `session:${sessionToken}`);
            joinRoom(ws, `table:${ws.tableId}`);
          }
        }
      } catch {
        ws.close(4001, 'Invalid token');
        return;
      }
    } else if (sessionToken) {
      const session = await Session.findOne({ token: sessionToken, isActive: true });
      if (!session || session.expiresAt < new Date()) {
        ws.close(4001, 'Invalid session');
        return;
      }
      ws.sessionToken = sessionToken;
      ws.tableId = session.tableId.toString();
      ws.restaurantId = session.restaurantId.toString();

      joinRoom(ws, `session:${sessionToken}`);
      joinRoom(ws, `table:${ws.tableId}`);
    }

    logger.info('ws_connected', { wsId: ws.id, role: ws.role || 'guest', restaurantId: ws.restaurantId });
  });

  // Heartbeat every 30s
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30_000);

  wss.on('close', () => clearInterval(heartbeat));
}

function handleMessage(ws, msg) {
  if (msg.event === 'PING') {
    ws.send(JSON.stringify({ event: 'PONG', timestamp: new Date().toISOString() }));
    return;
  }

  if (msg.event === 'SUBSCRIBE' && msg.payload?.room) {
    joinRoom(ws, msg.payload.room);
  }

  if (msg.event === 'REPLAY_REQUEST' && msg.payload?.last_event_id) {
    // Replay for all rooms the ws is in
    if (ws.rooms) {
      ws.rooms.forEach((room) => replayEvents(ws, room, msg.payload.last_event_id));
    }
  }
}

function parseCookieToken(cookieHeader) {
  const match = cookieHeader.match(/session_token=([^;]+)/);
  return match ? match[1] : null;
}

module.exports = { initWebSocket };
