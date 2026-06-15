const request = require('supertest');
const app = require('../src/app');
const { connectTestDB, clearDB, disconnectTestDB } = require('./setup/db');
const { createRestaurant, createTable, createSession, createStaff, authHeader } = require('./setup/helpers');
const Category = require('../src/models/Category');
const MenuItem = require('../src/models/MenuItem');
const Order = require('../src/models/Order');
const OrderItem = require('../src/models/OrderItem');
const Table = require('../src/models/Table');

beforeAll(() => connectTestDB());
afterEach(() => clearDB());
afterAll(() => disconnectTestDB());

async function seedMenuItem(restaurantId) {
  const cat = await Category.create({ name: 'Тест', sortOrder: 1, restaurantId });
  return MenuItem.create({ name: 'Тестова страва', basePrice: 100, categoryId: cat._id, restaurantId, isAvailable: true });
}

describe('POST /api/:restaurantId/orders', () => {
  it('creates order with items and sets table to occupied', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);
    const menuItem = await seedMenuItem(restaurant._id);

    const res = await request(app)
      .post(`/api/${restaurant._id}/orders`)
      .set('Cookie', `session_token=${session.token}`)
      .send({
        tableId: table._id,
        sessionToken: session.token,
        items: [{ menuItemId: menuItem._id, qty: 2 }],
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('order');
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].qty).toBe(2);

    const updatedTable = await Table.findById(table._id);
    expect(updatedTable.status).toBe('occupied');
  });

  it('returns 401 with invalid session token', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const menuItem = await seedMenuItem(restaurant._id);

    const res = await request(app).post(`/api/${restaurant._id}/orders`).send({
      tableId: table._id,
      sessionToken: 'invalid-token-xyz',
      items: [{ menuItemId: menuItem._id, qty: 1 }],
    });

    expect(res.status).toBe(401);
  });

  it('returns 400 if items array is empty', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);

    const res = await request(app).post(`/api/${restaurant._id}/orders`).send({
      tableId: table._id,
      sessionToken: session.token,
      items: [],
    });

    expect(res.status).toBe(400);
  });

  it('order status defaults to open', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);
    const menuItem = await seedMenuItem(restaurant._id);

    const res = await request(app)
      .post(`/api/${restaurant._id}/orders`)
      .send({ tableId: table._id, sessionToken: session.token, items: [{ menuItemId: menuItem._id, qty: 1 }] });

    expect(res.body.data.order.status).toBe('open');
  });
});

describe('POST /api/:restaurantId/orders/:orderId/cancel', () => {
  it('waiter can cancel an order with valid reason', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);
    const menuItem = await seedMenuItem(restaurant._id);
    const waiter = await createStaff('waiter', restaurant._id);

    const orderRes = await request(app)
      .post(`/api/${restaurant._id}/orders`)
      .send({ tableId: table._id, sessionToken: session.token, items: [{ menuItemId: menuItem._id, qty: 1 }] });
    const orderId = orderRes.body.data.order._id;

    const cancelRes = await request(app)
      .post(`/api/${restaurant._id}/orders/${orderId}/cancel`)
      .set(authHeader(waiter))
      .send({ reason: 'Гість передумав замовляти' });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('cancelled');

    const order = await Order.findById(orderId);
    expect(order.status).toBe('cancelled');
  });

  it('admin can cancel an order with valid reason', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);
    const menuItem = await seedMenuItem(restaurant._id);
    const admin = await createStaff('admin', restaurant._id);

    const orderRes = await request(app)
      .post(`/api/${restaurant._id}/orders`)
      .send({ tableId: table._id, sessionToken: session.token, items: [{ menuItemId: menuItem._id, qty: 1 }] });
    const orderId = orderRes.body.data.order._id;

    const cancelRes = await request(app)
      .post(`/api/${restaurant._id}/orders/${orderId}/cancel`)
      .set(authHeader(admin))
      .send({ reason: 'Адмін скасував замовлення' });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('cancelled');
  });

  it('returns 400 if cancel reason is less than 10 characters', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);
    const menuItem = await seedMenuItem(restaurant._id);
    const waiter = await createStaff('waiter', restaurant._id);

    const orderRes = await request(app)
      .post(`/api/${restaurant._id}/orders`)
      .send({ tableId: table._id, sessionToken: session.token, items: [{ menuItemId: menuItem._id, qty: 1 }] });
    const orderId = orderRes.body.data.order._id;

    // Simulate kitchen accepting the order so reason validation activates
    await OrderItem.updateMany({ orderId }, { dishStatus: 'cooking' });

    const res = await request(app)
      .post(`/api/${restaurant._id}/orders/${orderId}/cancel`)
      .set(authHeader(waiter))
      .send({ reason: 'Коротко' });

    expect(res.status).toBe(400);
  });

  it('cannot cancel an already completed order', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);
    const menuItem = await seedMenuItem(restaurant._id);
    const waiter = await createStaff('waiter', restaurant._id);

    const orderRes = await request(app)
      .post(`/api/${restaurant._id}/orders`)
      .send({ tableId: table._id, sessionToken: session.token, items: [{ menuItemId: menuItem._id, qty: 1 }] });
    const orderId = orderRes.body.data.order._id;

    await Order.findByIdAndUpdate(orderId, { status: 'completed_cash' });

    const res = await request(app)
      .post(`/api/${restaurant._id}/orders/${orderId}/cancel`)
      .set(authHeader(waiter))
      .send({ reason: 'Спроба скасувати completed' });

    expect(res.status).toBe(400);
  });

  it('returns 403 if guest tries to cancel an order', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);
    const menuItem = await seedMenuItem(restaurant._id);
    const guest = await createStaff('guest', restaurant._id);

    const orderRes = await request(app)
      .post(`/api/${restaurant._id}/orders`)
      .send({ tableId: table._id, sessionToken: session.token, items: [{ menuItemId: menuItem._id, qty: 1 }] });
    const orderId = orderRes.body.data.order._id;

    const res = await request(app)
      .post(`/api/${restaurant._id}/orders/${orderId}/cancel`)
      .set(authHeader(guest))
      .send({ reason: 'Гість намагається скасувати' });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/:restaurantId/orders/:orderId', () => {
  it('guest can view own order via session cookie', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);
    const menuItem = await seedMenuItem(restaurant._id);

    const orderRes = await request(app)
      .post(`/api/${restaurant._id}/orders`)
      .send({ tableId: table._id, sessionToken: session.token, items: [{ menuItemId: menuItem._id, qty: 1 }] });
    const orderId = orderRes.body.data.order._id;

    const res = await request(app)
      .get(`/api/${restaurant._id}/orders/${orderId}`)
      .set('Cookie', `session_token=${session.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.order._id).toBe(orderId);
  });

  it('waiter can view any order in restaurant', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);
    const menuItem = await seedMenuItem(restaurant._id);
    const waiter = await createStaff('waiter', restaurant._id);

    const orderRes = await request(app)
      .post(`/api/${restaurant._id}/orders`)
      .send({ tableId: table._id, sessionToken: session.token, items: [{ menuItemId: menuItem._id, qty: 1 }] });
    const orderId = orderRes.body.data.order._id;

    const res = await request(app)
      .get(`/api/${restaurant._id}/orders/${orderId}`)
      .set(authHeader(waiter));

    expect(res.status).toBe(200);
  });
});
