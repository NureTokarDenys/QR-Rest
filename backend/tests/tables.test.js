const request = require('supertest');
const app = require('../src/app');
const { connectTestDB, clearDB, disconnectTestDB } = require('./setup/db');
const { createRestaurant, createTable, createSession, createStaff, authHeader } = require('./setup/helpers');
const Table = require('../src/models/Table');
const Category = require('../src/models/Category');
const MenuItem = require('../src/models/MenuItem');
const Order = require('../src/models/Order');

beforeAll(() => connectTestDB());
afterEach(() => clearDB());
afterAll(() => disconnectTestDB());

describe('Admin table management', () => {
  it('admin can create a table with auto-generated short-code', async () => {
    const restaurant = await createRestaurant();
    const admin = await createStaff('admin', restaurant._id);

    const res = await request(app)
      .post(`/api/${restaurant._id}/admin/tables`)
      .set(authHeader(admin))
      .send({ number: 5, label: 'Вікно' });

    expect(res.status).toBe(201);
    expect(res.body.data.number).toBe(5);
    expect(res.body.data.shortCode).toMatch(/^[A-Z0-9]{4,8}$/);
  });

  it('admin can list all tables', async () => {
    const restaurant = await createRestaurant();
    const admin = await createStaff('admin', restaurant._id);
    await Promise.all([1, 2, 3].map((n) => createTable(restaurant._id, { number: n })));

    const res = await request(app)
      .get(`/api/${restaurant._id}/admin/tables`)
      .set(authHeader(admin));

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(3);
  });

  it('admin can disable (DELETE) a table', async () => {
    const restaurant = await createRestaurant();
    const admin = await createStaff('admin', restaurant._id);
    const table = await createTable(restaurant._id);

    const res = await request(app)
      .delete(`/api/${restaurant._id}/admin/tables/${table._id}`)
      .set(authHeader(admin));

    expect(res.status).toBe(200);

    const updated = await Table.findById(table._id);
    expect(updated.status).toBe('disabled');
  });

  it('disabled table returns available:false on QR scan', async () => {
    const restaurant = await createRestaurant();
    const admin = await createStaff('admin', restaurant._id);
    const table = await createTable(restaurant._id);

    await request(app).delete(`/api/${restaurant._id}/admin/tables/${table._id}`).set(authHeader(admin));

    const updatedTable = await Table.findById(table._id);
    const res = await request(app).get(`/api/qr/${updatedTable.shortCode}`);

    expect(res.body.data.available).toBe(false);
  });

  it('waiter can access admin/tables (table map is shared by waiter + admin)', async () => {
    const restaurant = await createRestaurant();
    const waiter = await createStaff('waiter', restaurant._id);

    const res = await request(app)
      .get(`/api/${restaurant._id}/admin/tables`)
      .set(authHeader(waiter));

    expect(res.status).toBe(200);
  });
});

describe('POST /api/:restaurantId/waiter/tables/:tableId/close', () => {
  it('waiter can close table and cancel active orders', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id, { status: 'occupied' });
    const session = await createSession(table._id, restaurant._id);
    const waiter = await createStaff('waiter', restaurant._id);

    // Create an active order
    const cat = await Category.create({ name: 'Тест', sortOrder: 1, restaurantId: restaurant._id });
    const menuItem = await MenuItem.create({ name: 'Суп', basePrice: 80, categoryId: cat._id, restaurantId: restaurant._id, isAvailable: true });
    await request(app).post(`/api/${restaurant._id}/orders`).send({ tableId: table._id, sessionToken: session.token, items: [{ menuItemId: menuItem._id, qty: 1 }] });

    const res = await request(app)
      .post(`/api/${restaurant._id}/waiter/tables/${table._id}/close`)
      .set(authHeader(waiter))
      .send({ reason: 'Закриваємо стіл в кінці зміни' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('free');
    expect(res.body.data.cancelledOrders).toBeGreaterThan(0);

    const updatedTable = await Table.findById(table._id);
    expect(updatedTable.status).toBe('free');

    const cancelledOrders = await Order.find({ tableId: table._id, status: 'cancelled' });
    expect(cancelledOrders.length).toBeGreaterThan(0);
  });

  it('returns 400 without reason', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const waiter = await createStaff('waiter', restaurant._id);

    const res = await request(app)
      .post(`/api/${restaurant._id}/waiter/tables/${table._id}/close`)
      .set(authHeader(waiter))
      .send({});

    expect(res.status).toBe(400);
  });
});
