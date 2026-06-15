'use strict';

const http = require('http');
const WebSocket = require('ws');
const request = require('supertest');
const app = require('../src/app');
const { initWebSocket } = require('../src/websocket/wsServer');
const { __resetForTests__, emit } = require('../src/services/wsService');
const { connectTestDB, clearDB, disconnectTestDB } = require('./setup/db');
const { createRestaurant, createTable, createSession, createStaff, authHeader } = require('./setup/helpers');
const Category = require('../src/models/Category');
const MenuItem = require('../src/models/MenuItem');
const Order = require('../src/models/Order');
const OrderItem = require('../src/models/OrderItem');
const ServingGroup = require('../src/models/ServingGroup');

// ─── Server lifecycle ────────────────────────────────────────────────────────

let server;
let port;
const openSockets = new Set();

beforeAll(async () => {
  await connectTestDB();
  server = http.createServer(app);
  initWebSocket(server);
  await new Promise((resolve) => server.listen(0, resolve));
  port = server.address().port;
}, 15000);

afterEach(async () => {
  // Force-close any WS connections left open by a failing test
  for (const ws of openSockets) {
    if (ws.readyState !== WebSocket.CLOSED) ws.terminate();
  }
  openSockets.clear();
  await clearDB();
  __resetForTests__();
});

afterAll(async () => {
  // Destroy all remaining connections so server.close() doesn't hang
  server.closeAllConnections?.();
  await new Promise((resolve) => server.close(resolve));
  await disconnectTestDB();
}, 15000);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function wsUrl(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return `ws://127.0.0.1:${port}/ws${qs ? '?' + qs : ''}`;
}

/** Open a WebSocket, register it for auto-cleanup, and resolve once connected. */
function connectWs(params = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl(params));
    openSockets.add(ws);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

/** Resolve with the first message whose event field matches eventName. */
function waitForEvent(ws, eventName, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout: no "${eventName}" within ${timeoutMs}ms`)),
      timeoutMs
    );
    const handler = (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (msg.event === eventName) {
        clearTimeout(timer);
        ws.off('message', handler);
        resolve(msg);
      }
    };
    ws.on('message', handler);
  });
}

/** Collect ALL messages arriving within windowMs. */
function collectEvents(ws, windowMs = 500) {
  return new Promise((resolve) => {
    const msgs = [];
    const handler = (raw) => {
      try { msgs.push(JSON.parse(raw.toString())); } catch {}
    };
    ws.on('message', handler);
    setTimeout(() => {
      ws.off('message', handler);
      resolve(msgs);
    }, windowMs);
  });
}

/**
 * Wait for the server to process all previously queued messages by doing a
 * PING/PONG round-trip.  Because the server processes messages in order,
 * receiving PONG guarantees every prior message (e.g. SUBSCRIBE) was handled.
 */
async function flushServer(ws) {
  const pong = waitForEvent(ws, 'PONG');
  ws.send(JSON.stringify({ event: 'PING' }));
  await pong;
}

/** Close a WebSocket and wait for the close event. */
function closeWs(ws) {
  return new Promise((resolve) => {
    openSockets.delete(ws);
    if (ws.readyState === WebSocket.CLOSED) return resolve();
    ws.once('close', resolve);
    ws.close();
  });
}

async function seedMenuItem(restaurantId) {
  const cat = await Category.create({ name: 'Test', sortOrder: 1, restaurantId });
  return MenuItem.create({
    name: 'Test Dish',
    basePrice: 100,
    categoryId: cat._id,
    restaurantId,
    isAvailable: true,
  });
}

async function createOrder(restaurant, table, session, menuItem, extraItems = []) {
  const items = [{ menuItemId: menuItem._id, qty: 1 }, ...extraItems];
  const res = await request(app)
    .post(`/api/${restaurant._id}/orders`)
    .set('Cookie', `session_token=${session.token}`)
    .send({ tableId: table._id, sessionToken: session.token, items });
  if (res.status !== 200) throw new Error(`createOrder failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data;
}

// ─── Authentication tests ─────────────────────────────────────────────────────

describe('WebSocket authentication', () => {
  it('guest connects successfully with a valid session token', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);

    const ws = await connectWs({ session_token: session.token });
    expect(ws.readyState).toBe(WebSocket.OPEN);
    await closeWs(ws);
  });

  it('staff (waiter) connects successfully with a valid JWT', async () => {
    const restaurant = await createRestaurant();
    const staff = await createStaff('waiter', restaurant._id);
    const token = authHeader(staff).Authorization.replace('Bearer ', '');

    const ws = await connectWs({ token });
    expect(ws.readyState).toBe(WebSocket.OPEN);
    await closeWs(ws);
  });

  it('staff (cook) connects successfully with a valid JWT', async () => {
    const restaurant = await createRestaurant();
    const staff = await createStaff('cook', restaurant._id);
    const token = authHeader(staff).Authorization.replace('Bearer ', '');

    const ws = await connectWs({ token });
    expect(ws.readyState).toBe(WebSocket.OPEN);
    await closeWs(ws);
  });

  it('rejects connection with an invalid bearer token (closes with 4001)', async () => {
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl({ token: 'totally-invalid-jwt' }));
      openSockets.add(ws);
      ws.on('close', (code) => {
        openSockets.delete(ws);
        expect(code).toBe(4001);
        resolve();
      });
      ws.on('error', () => {});
      setTimeout(() => reject(new Error('Timeout: connection not closed')), 4000);
    });
  });

  it('rejects connection with an invalid session token (closes with 4001)', async () => {
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl({ session_token: 'not-a-real-session' }));
      openSockets.add(ws);
      ws.on('close', (code) => {
        openSockets.delete(ws);
        expect(code).toBe(4001);
        resolve();
      });
      ws.on('error', () => {});
      setTimeout(() => reject(new Error('Timeout: connection not closed')), 4000);
    });
  });

  it('rejects connection when session is expired (closes with 4001)', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id, {
      expiresAt: new Date(Date.now() - 1000),
    });

    await new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl({ session_token: session.token }));
      openSockets.add(ws);
      ws.on('close', (code) => {
        openSockets.delete(ws);
        expect(code).toBe(4001);
        resolve();
      });
      ws.on('error', () => {});
      setTimeout(() => reject(new Error('Timeout: connection not closed')), 4000);
    });
  });
});

// ─── Protocol tests ───────────────────────────────────────────────────────────

describe('WebSocket protocol', () => {
  it('responds to PING with PONG', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);

    const ws = await connectWs({ session_token: session.token });
    const pongPromise = waitForEvent(ws, 'PONG');
    ws.send(JSON.stringify({ event: 'PING' }));
    const msg = await pongPromise;
    expect(msg.event).toBe('PONG');
    await closeWs(ws);
  });

  it('SUBSCRIBE allows a client to receive events on a custom room', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);

    const ws = await connectWs({ session_token: session.token });
    ws.send(JSON.stringify({ event: 'SUBSCRIBE', payload: { room: 'custom:test-room' } }));
    await flushServer(ws); // ensures SUBSCRIBE was processed before we emit

    const eventPromise = waitForEvent(ws, 'TEST_EVENT');
    emit('custom:test-room', 'TEST_EVENT', { hello: 'world' });
    const msg = await eventPromise;

    expect(msg.event).toBe('TEST_EVENT');
    expect(msg.payload).toEqual({ hello: 'world' });
    expect(msg).toHaveProperty('event_id');
    expect(msg).toHaveProperty('timestamp');
    await closeWs(ws);
  });

  it('REPLAY_REQUEST resends events missed after the given event_id', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);

    const ws = await connectWs({ session_token: session.token });
    // For session-based connections the server does an async DB lookup before
    // calling joinRoom.  flushServer (PING/PONG round-trip) guarantees the
    // lookup has completed and the ws is in its rooms before we emit.
    await flushServer(ws);
    const room = `session:${session.token}`;

    const liveCollect = collectEvents(ws, 600);
    emit(room, 'FIRST_EVENT', { n: 1 });
    emit(room, 'SECOND_EVENT', { n: 2 });
    emit(room, 'THIRD_EVENT', { n: 3 });
    const live = await liveCollect;

    expect(live).toHaveLength(3);
    const firstId = live[0].event_id;

    const replayCollect = collectEvents(ws, 600);
    ws.send(JSON.stringify({ event: 'REPLAY_REQUEST', payload: { last_event_id: firstId } }));
    const replayed = await replayCollect;

    expect(replayed.map((m) => m.event)).toEqual(['SECOND_EVENT', 'THIRD_EVENT']);
    await closeWs(ws);
  });

  it('message envelope always contains event, payload, timestamp, event_id', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);

    const ws = await connectWs({ session_token: session.token });
    await flushServer(ws); // wait for async session DB lookup + joinRoom to complete
    const eventPromise = waitForEvent(ws, 'ENVELOPE_CHECK');
    emit(`session:${session.token}`, 'ENVELOPE_CHECK', { x: 42 });
    const msg = await eventPromise;

    expect(msg).toMatchObject({ event: 'ENVELOPE_CHECK', payload: { x: 42 } });
    expect(typeof msg.timestamp).toBe('string');
    expect(typeof msg.event_id).toBe('string');
    await closeWs(ws);
  });
});

// ─── Order events ─────────────────────────────────────────────────────────────

describe('ORDER_NEW', () => {
  it('kitchen staff receives ORDER_NEW when an order is created', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);
    const menuItem = await seedMenuItem(restaurant._id);
    const cook = await createStaff('cook', restaurant._id);
    const cookToken = authHeader(cook).Authorization.replace('Bearer ', '');

    const kitchenWs = await connectWs({ token: cookToken });
    const eventPromise = waitForEvent(kitchenWs, 'ORDER_NEW');

    await request(app)
      .post(`/api/${restaurant._id}/orders`)
      .set('Cookie', `session_token=${session.token}`)
      .send({ tableId: table._id, sessionToken: session.token, items: [{ menuItemId: menuItem._id, qty: 1 }] });

    const msg = await eventPromise;
    expect(msg.event).toBe('ORDER_NEW');
    expect(msg.payload).toHaveProperty('orderId');
    expect(msg.payload).toHaveProperty('tableNumber');
    await closeWs(kitchenWs);
  });

  it('waiter staff receives ORDER_NEW when an order is created', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);
    const menuItem = await seedMenuItem(restaurant._id);
    const waiter = await createStaff('waiter', restaurant._id);
    const waiterToken = authHeader(waiter).Authorization.replace('Bearer ', '');

    const waiterWs = await connectWs({ token: waiterToken });
    const eventPromise = waitForEvent(waiterWs, 'ORDER_NEW');

    await request(app)
      .post(`/api/${restaurant._id}/orders`)
      .set('Cookie', `session_token=${session.token}`)
      .send({ tableId: table._id, sessionToken: session.token, items: [{ menuItemId: menuItem._id, qty: 2 }] });

    const msg = await eventPromise;
    expect(msg.event).toBe('ORDER_NEW');
    expect(msg.payload).toHaveProperty('orderId');
    expect(msg.payload).toHaveProperty('tableNumber');
    await closeWs(waiterWs);
  });

  it('guest client does NOT receive ORDER_NEW (wrong room)', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);
    const menuItem = await seedMenuItem(restaurant._id);

    const guestWs = await connectWs({ session_token: session.token });
    const incoming = collectEvents(guestWs, 800);

    await request(app)
      .post(`/api/${restaurant._id}/orders`)
      .set('Cookie', `session_token=${session.token}`)
      .send({ tableId: table._id, sessionToken: session.token, items: [{ menuItemId: menuItem._id, qty: 1 }] });

    const msgs = await incoming;
    expect(msgs.some((m) => m.event === 'ORDER_NEW')).toBe(false);
    await closeWs(guestWs);
  });
});

describe('ORDER_ITEMS_ADDED', () => {
  it('kitchen staff receives ORDER_ITEMS_ADDED when guest adds to an existing order', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);
    const menuItem = await seedMenuItem(restaurant._id);
    const cook = await createStaff('cook', restaurant._id);
    const cookToken = authHeader(cook).Authorization.replace('Bearer ', '');

    const orderData = await createOrder(restaurant, table, session, menuItem);
    const orderId = orderData.order._id;

    const kitchenWs = await connectWs({ token: cookToken });
    const eventPromise = waitForEvent(kitchenWs, 'ORDER_ITEMS_ADDED');

    await request(app)
      .post(`/api/${restaurant._id}/orders/${orderId}/guest-items`)
      .send({ sessionToken: session.token, items: [{ menuItemId: menuItem._id, qty: 1 }] });

    const msg = await eventPromise;
    expect(msg.event).toBe('ORDER_ITEMS_ADDED');
    expect(String(msg.payload.orderId)).toBe(String(orderId));
    await closeWs(kitchenWs);
  });
});

describe('ORDER_CANCELLED (client cancel)', () => {
  it('session client receives ORDER_CANCELLED when they cancel their own order', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);
    const menuItem = await seedMenuItem(restaurant._id);

    const orderData = await createOrder(restaurant, table, session, menuItem);
    const orderId = orderData.order._id;

    const guestWs = await connectWs({ session_token: session.token });
    const eventPromise = waitForEvent(guestWs, 'ORDER_CANCELLED');

    await request(app)
      .post(`/api/${restaurant._id}/orders/${orderId}/client-cancel`)
      .send({ sessionToken: session.token });

    const msg = await eventPromise;
    expect(msg.event).toBe('ORDER_CANCELLED');
    expect(String(msg.payload.orderId)).toBe(String(orderId));
    await closeWs(guestWs);
  });

  it('kitchen staff receives ORDER_CANCELLED when guest cancels', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);
    const menuItem = await seedMenuItem(restaurant._id);
    const cook = await createStaff('cook', restaurant._id);
    const cookToken = authHeader(cook).Authorization.replace('Bearer ', '');

    const orderData = await createOrder(restaurant, table, session, menuItem);
    const orderId = orderData.order._id;

    const kitchenWs = await connectWs({ token: cookToken });
    const eventPromise = waitForEvent(kitchenWs, 'ORDER_CANCELLED');

    await request(app)
      .post(`/api/${restaurant._id}/orders/${orderId}/client-cancel`)
      .send({ sessionToken: session.token });

    const msg = await eventPromise;
    expect(msg.event).toBe('ORDER_CANCELLED');
    await closeWs(kitchenWs);
  });
});

describe('ORDER_CANCELLED (staff void)', () => {
  it('session client receives ORDER_CANCELLED when a waiter voids the order', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);
    const menuItem = await seedMenuItem(restaurant._id);
    const waiter = await createStaff('waiter', restaurant._id);

    const orderData = await createOrder(restaurant, table, session, menuItem);
    const orderId = orderData.order._id;

    const guestWs = await connectWs({ session_token: session.token });
    const eventPromise = waitForEvent(guestWs, 'ORDER_CANCELLED');

    await request(app)
      .post(`/api/${restaurant._id}/orders/${orderId}/void`)
      .set(authHeader(waiter))
      .send({ reason: 'Staff void test' });

    const msg = await eventPromise;
    expect(msg.event).toBe('ORDER_CANCELLED');
    expect(String(msg.payload.orderId)).toBe(String(orderId));
    await closeWs(guestWs);
  });
});

// ─── Dish / item status events ────────────────────────────────────────────────

describe('DISH_STATUS_UPDATED', () => {
  it('session client receives DISH_STATUS_UPDATED when kitchen updates a group', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);
    const menuItem = await seedMenuItem(restaurant._id);
    const cook = await createStaff('cook', restaurant._id);

    const orderData = await createOrder(restaurant, table, session, menuItem);
    const orderId = orderData.order._id;
    const group = await ServingGroup.findOne({ orderId });

    const guestWs = await connectWs({ session_token: session.token });
    const eventPromise = waitForEvent(guestWs, 'DISH_STATUS_UPDATED');

    await request(app)
      .patch(`/api/${restaurant._id}/kitchen/orders/${orderId}/groups/${group._id}/status`)
      .set(authHeader(cook))
      .send({ status: 'cooking' });

    const msg = await eventPromise;
    expect(msg.event).toBe('DISH_STATUS_UPDATED');
    expect(msg.payload.dishStatus).toBe('cooking');
    expect(String(msg.payload.orderId)).toBe(String(orderId));
    await closeWs(guestWs);
  });

  it('waiter receives DISH_STATUS_UPDATED when kitchen updates a group', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);
    const menuItem = await seedMenuItem(restaurant._id);
    const cook = await createStaff('cook', restaurant._id);
    const waiter = await createStaff('waiter', restaurant._id);

    const orderData = await createOrder(restaurant, table, session, menuItem);
    const orderId = orderData.order._id;
    const group = await ServingGroup.findOne({ orderId });

    const waiterWs = await connectWs({ token: authHeader(waiter).Authorization.replace('Bearer ', '') });
    const eventPromise = waitForEvent(waiterWs, 'DISH_STATUS_UPDATED');

    await request(app)
      .patch(`/api/${restaurant._id}/kitchen/orders/${orderId}/groups/${group._id}/status`)
      .set(authHeader(cook))
      .send({ status: 'cooking' });

    const msg = await eventPromise;
    expect(msg.event).toBe('DISH_STATUS_UPDATED');
    expect(msg.payload.dishStatus).toBe('cooking');
    await closeWs(waiterWs);
  });

  it('session client receives DISH_STATUS_UPDATED when a single item status is updated', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);
    const menuItem = await seedMenuItem(restaurant._id);
    const cook = await createStaff('cook', restaurant._id);

    const orderData = await createOrder(restaurant, table, session, menuItem);
    const orderId = orderData.order._id;
    const item = await OrderItem.findOne({ orderId });

    const guestWs = await connectWs({ session_token: session.token });
    const eventPromise = waitForEvent(guestWs, 'DISH_STATUS_UPDATED');

    await request(app)
      .patch(`/api/${restaurant._id}/kitchen/orders/${orderId}/items/${item._id}/status`)
      .set(authHeader(cook))
      .send({ status: 'cooking' });

    const msg = await eventPromise;
    expect(msg.event).toBe('DISH_STATUS_UPDATED');
    expect(msg.payload.dishStatus).toBe('cooking');
    expect(String(msg.payload.orderItemId)).toBe(String(item._id));
    await closeWs(guestWs);
  });
});

// ─── Group status events ──────────────────────────────────────────────────────

describe('GROUP_STATUS_UPDATED', () => {
  it('session client receives GROUP_STATUS_UPDATED when a group is advanced', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);
    const menuItem = await seedMenuItem(restaurant._id);
    // This route requires cook/waiter_cook/admin
    const cook = await createStaff('cook', restaurant._id);

    const orderData = await createOrder(restaurant, table, session, menuItem);
    const orderId = orderData.order._id;
    const group = await ServingGroup.findOne({ orderId });

    const guestWs = await connectWs({ session_token: session.token });
    const eventPromise = waitForEvent(guestWs, 'GROUP_STATUS_UPDATED');

    await request(app)
      .patch(`/api/${restaurant._id}/orders/${orderId}/groups/${group._id}/status`)
      .set(authHeader(cook))
      .send({ status: 'cooking' });

    const msg = await eventPromise;
    expect(msg.event).toBe('GROUP_STATUS_UPDATED');
    expect(msg.payload.status).toBe('cooking');
    expect(String(msg.payload.groupId)).toBe(String(group._id));
    await closeWs(guestWs);
  });

  it('kitchen staff receives GROUP_STATUS_UPDATED', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);
    const menuItem = await seedMenuItem(restaurant._id);
    const cook = await createStaff('cook', restaurant._id);
    const cook2 = await createStaff('cook', restaurant._id);

    const orderData = await createOrder(restaurant, table, session, menuItem);
    const orderId = orderData.order._id;
    const group = await ServingGroup.findOne({ orderId });

    const cookWs = await connectWs({ token: authHeader(cook2).Authorization.replace('Bearer ', '') });
    const eventPromise = waitForEvent(cookWs, 'GROUP_STATUS_UPDATED');

    await request(app)
      .patch(`/api/${restaurant._id}/orders/${orderId}/groups/${group._id}/status`)
      .set(authHeader(cook))
      .send({ status: 'cooking' });

    const msg = await eventPromise;
    expect(msg.event).toBe('GROUP_STATUS_UPDATED');
    await closeWs(cookWs);
  });
});

// ─── Waiter call events ───────────────────────────────────────────────────────

describe('WAITER_CALL', () => {
  it('waiter receives WAITER_CALL when a guest calls for service', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id, { status: 'occupied' });
    const session = await createSession(table._id, restaurant._id);
    const menuItem = await seedMenuItem(restaurant._id);
    const waiter = await createStaff('waiter', restaurant._id);

    const orderData = await createOrder(restaurant, table, session, menuItem);
    const orderId = orderData.order._id;

    const waiterWs = await connectWs({ token: authHeader(waiter).Authorization.replace('Bearer ', '') });
    const eventPromise = waitForEvent(waiterWs, 'WAITER_CALL');

    await request(app)
      .post(`/api/${restaurant._id}/orders/${orderId}/waiter-call`)
      .set('Cookie', `session_token=${session.token}`);

    const msg = await eventPromise;
    expect(msg.event).toBe('WAITER_CALL');
    expect(String(msg.payload.orderId)).toBe(String(orderId));
    expect(msg.payload).toHaveProperty('tableNumber');
    await closeWs(waiterWs);
  });
});

describe('WAITER_CALL_RESOLVED', () => {
  it('session client receives WAITER_CALL_RESOLVED when waiter confirms the call', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id, { status: 'occupied' });
    const session = await createSession(table._id, restaurant._id);
    const menuItem = await seedMenuItem(restaurant._id);
    const waiter = await createStaff('waiter', restaurant._id);

    const orderData = await createOrder(restaurant, table, session, menuItem);
    const orderId = orderData.order._id;

    const callRes = await request(app)
      .post(`/api/${restaurant._id}/orders/${orderId}/waiter-call`)
      .set('Cookie', `session_token=${session.token}`);
    const callId = callRes.body.data.callId;

    const guestWs = await connectWs({ session_token: session.token });
    const eventPromise = waitForEvent(guestWs, 'WAITER_CALL_RESOLVED');

    await request(app)
      .patch(`/api/${restaurant._id}/waiter/calls/${callId}/resolve`)
      .set(authHeader(waiter));

    const msg = await eventPromise;
    expect(msg.event).toBe('WAITER_CALL_RESOLVED');
    await closeWs(guestWs);
  });

  it('waiter room receives WAITER_CALL_RESOLVED when a waiter_call is resolved', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id, { status: 'occupied' });
    const session = await createSession(table._id, restaurant._id);
    const menuItem = await seedMenuItem(restaurant._id);
    const waiter = await createStaff('waiter', restaurant._id);
    const waiter2 = await createStaff('waiter', restaurant._id);

    const orderData = await createOrder(restaurant, table, session, menuItem);
    const orderId = orderData.order._id;

    const callRes = await request(app)
      .post(`/api/${restaurant._id}/orders/${orderId}/waiter-call`)
      .set('Cookie', `session_token=${session.token}`);
    const callId = callRes.body.data.callId;

    const observerWs = await connectWs({ token: authHeader(waiter2).Authorization.replace('Bearer ', '') });
    const eventPromise = waitForEvent(observerWs, 'WAITER_CALL_RESOLVED');

    await request(app)
      .patch(`/api/${restaurant._id}/waiter/calls/${callId}/resolve`)
      .set(authHeader(waiter));

    const msg = await eventPromise;
    expect(msg.event).toBe('WAITER_CALL_RESOLVED');
    expect(String(msg.payload.callId)).toBe(String(callId));
    await closeWs(observerWs);
  });
});

// ─── Multi-client fan-out ─────────────────────────────────────────────────────

describe('Multi-client fan-out', () => {
  it('two guests at the same table both receive ORDER_CANCELLED', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);
    const menuItem = await seedMenuItem(restaurant._id);
    const waiter = await createStaff('waiter', restaurant._id);

    const orderData = await createOrder(restaurant, table, session, menuItem);
    const orderId = orderData.order._id;

    const guest1 = await connectWs({ session_token: session.token });
    const guest2 = await connectWs({ session_token: session.token });

    const [p1, p2] = [
      waitForEvent(guest1, 'ORDER_CANCELLED'),
      waitForEvent(guest2, 'ORDER_CANCELLED'),
    ];

    await request(app)
      .post(`/api/${restaurant._id}/orders/${orderId}/void`)
      .set(authHeader(waiter))
      .send({ reason: 'fan-out test' });

    const [m1, m2] = await Promise.all([p1, p2]);
    expect(m1.event).toBe('ORDER_CANCELLED');
    expect(m2.event).toBe('ORDER_CANCELLED');
    await Promise.all([closeWs(guest1), closeWs(guest2)]);
  });

  it('cook and waiter both receive ORDER_NEW for the same order', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);
    const menuItem = await seedMenuItem(restaurant._id);
    const cook = await createStaff('cook', restaurant._id);
    const waiter = await createStaff('waiter', restaurant._id);

    const cookWs = await connectWs({ token: authHeader(cook).Authorization.replace('Bearer ', '') });
    const waiterWs = await connectWs({ token: authHeader(waiter).Authorization.replace('Bearer ', '') });

    const [cp, wp] = [
      waitForEvent(cookWs, 'ORDER_NEW'),
      waitForEvent(waiterWs, 'ORDER_NEW'),
    ];

    await request(app)
      .post(`/api/${restaurant._id}/orders`)
      .set('Cookie', `session_token=${session.token}`)
      .send({ tableId: table._id, sessionToken: session.token, items: [{ menuItemId: menuItem._id, qty: 1 }] });

    const [cm, wm] = await Promise.all([cp, wp]);
    expect(cm.event).toBe('ORDER_NEW');
    expect(wm.event).toBe('ORDER_NEW');
    expect(String(cm.payload.orderId)).toBe(String(wm.payload.orderId));
    await Promise.all([closeWs(cookWs), closeWs(waiterWs)]);
  });
});
