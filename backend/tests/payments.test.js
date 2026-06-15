const request = require('supertest');
const app = require('../src/app');
const { connectTestDB, clearDB, disconnectTestDB } = require('./setup/db');
const { createRestaurant, createTable, createSession, createStaff, authHeader } = require('./setup/helpers');
const Category = require('../src/models/Category');
const MenuItem = require('../src/models/MenuItem');
const Order = require('../src/models/Order');
const Payment = require('../src/models/Payment');
const AuditLog = require('../src/models/AuditLog');

beforeAll(() => connectTestDB());
afterEach(() => clearDB());
afterAll(() => disconnectTestDB());

async function setupOrder(restaurantId, tableId, sessionToken) {
  const cat = await Category.create({ name: 'Тест', sortOrder: 1, restaurantId });
  const menuItem = await MenuItem.create({ name: 'Піца', basePrice: 200, categoryId: cat._id, restaurantId, isAvailable: true });

  const orderRes = await request(app).post(`/api/${restaurantId}/orders`).send({
    tableId,
    sessionToken,
    items: [{ menuItemId: menuItem._id, qty: 1 }],
  });
  return orderRes.body.data.order;
}

describe('POST /api/:restaurantId/payments/cash', () => {
  it('waiter can close order with cash payment', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);
    const waiter = await createStaff('waiter', restaurant._id);
    const order = await setupOrder(restaurant._id, table._id, session.token);

    const res = await request(app)
      .post(`/api/${restaurant._id}/payments/cash`)
      .set(authHeader(waiter))
      .send({ orderId: order._id });

    expect(res.status).toBe(200);
    expect(res.body.data.method).toBe('cash');
    expect(res.body.data.status).toBe('completed_cash');

    const updatedOrder = await Order.findById(order._id);
    expect(updatedOrder.status).toBe('completed_cash');
  });

  it('creates an audit log entry for cash payment', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);
    const waiter = await createStaff('waiter', restaurant._id);
    const order = await setupOrder(restaurant._id, table._id, session.token);

    await request(app)
      .post(`/api/${restaurant._id}/payments/cash`)
      .set(authHeader(waiter))
      .send({ orderId: order._id });

    const log = await AuditLog.findOne({ orderId: order._id, eventType: 'CASH_PAYMENT' });
    expect(log).not.toBeNull();
    expect(log.initiatedBy.role).toBe('waiter');
  });

  it('returns 400 if order is already completed', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);
    const waiter = await createStaff('waiter', restaurant._id);
    const order = await setupOrder(restaurant._id, table._id, session.token);

    await Order.findByIdAndUpdate(order._id, { status: 'completed_cash' });

    const res = await request(app)
      .post(`/api/${restaurant._id}/payments/cash`)
      .set(authHeader(waiter))
      .send({ orderId: order._id });

    expect(res.status).toBe(400);
  });

  it('returns 401 for unauthenticated request', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);
    const order = await setupOrder(restaurant._id, table._id, session.token);

    const res = await request(app)
      .post(`/api/${restaurant._id}/payments/cash`)
      .send({ orderId: order._id });

    expect(res.status).toBe(401);
  });
});

describe('Audit log immutability', () => {
  it('returns 405 on PUT to audit log', async () => {
    const restaurant = await createRestaurant();
    const admin = await createStaff('admin', restaurant._id);

    const res = await request(app)
      .put(`/api/${restaurant._id}/admin/audit-log/anything`)
      .set(authHeader(admin));

    expect(res.status).toBe(405);
  });

  it('returns 405 on DELETE to audit log', async () => {
    const restaurant = await createRestaurant();
    const admin = await createStaff('admin', restaurant._id);

    const res = await request(app)
      .delete(`/api/${restaurant._id}/admin/audit-log/anything`)
      .set(authHeader(admin));

    expect(res.status).toBe(405);
  });
});
