const request = require('supertest');
const app = require('../src/app');
const { connectTestDB, clearDB, disconnectTestDB } = require('./setup/db');
const { createRestaurant, createTable, createSession, createStaff, authHeader } = require('./setup/helpers');
const Category = require('../src/models/Category');
const MenuItem = require('../src/models/MenuItem');
const OrderItem = require('../src/models/OrderItem');
const Order = require('../src/models/Order');

beforeAll(() => connectTestDB());
afterEach(() => clearDB());
afterAll(() => disconnectTestDB());

async function setupOrderWithItem(restaurantId, tableId, sessionToken) {
  const cat = await Category.create({ name: 'Тест', sortOrder: 1, restaurantId });
  const menuItem = await MenuItem.create({ name: 'Бургер', basePrice: 150, categoryId: cat._id, restaurantId, isAvailable: true });

  const orderRes = await request(app).post(`/api/${restaurantId}/orders`).send({
    tableId,
    sessionToken,
    items: [{ menuItemId: menuItem._id, qty: 1 }],
  });
  const order = orderRes.body.data.order;
  const items = await OrderItem.find({ orderId: order._id });
  return { order, item: items[0] };
}

describe('GET /api/:restaurantId/kitchen/orders', () => {
  it('cook can view active orders', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);
    const cook = await createStaff('cook', restaurant._id);
    await setupOrderWithItem(restaurant._id, table._id, session.token);

    const res = await request(app)
      .get(`/api/${restaurant._id}/kitchen/orders`)
      .set(authHeader(cook));

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('returns 403 for guest on kitchen orders', async () => {
    const restaurant = await createRestaurant();
    const guest = await createStaff('guest', restaurant._id);

    const res = await request(app)
      .get(`/api/${restaurant._id}/kitchen/orders`)
      .set(authHeader(guest));

    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/:restaurantId/kitchen/orders/:orderId/items/:itemId/status', () => {
  it('cook can update dish status from waiting to cooking', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);
    const cook = await createStaff('cook', restaurant._id);
    const { order, item } = await setupOrderWithItem(restaurant._id, table._id, session.token);

    const res = await request(app)
      .patch(`/api/${restaurant._id}/kitchen/orders/${order._id}/items/${item._id}/status`)
      .set(authHeader(cook))
      .send({ status: 'cooking' });

    expect(res.status).toBe(200);
    expect(res.body.data.dishStatus).toBe('cooking');

    const updatedItem = await OrderItem.findById(item._id);
    expect(updatedItem.dishStatus).toBe('cooking');
  });

  it('cannot downgrade dish status', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);
    const cook = await createStaff('cook', restaurant._id);
    const { order, item } = await setupOrderWithItem(restaurant._id, table._id, session.token);

    await OrderItem.findByIdAndUpdate(item._id, { dishStatus: 'ready' });

    const res = await request(app)
      .patch(`/api/${restaurant._id}/kitchen/orders/${order._id}/items/${item._id}/status`)
      .set(authHeader(cook))
      .send({ status: 'cooking' });

    expect(res.status).toBe(400);
  });

  it('all dishes ready → order stays open (dish statuses track kitchen progress)', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);
    const cook = await createStaff('cook', restaurant._id);
    const { order, item } = await setupOrderWithItem(restaurant._id, table._id, session.token);

    await request(app)
      .patch(`/api/${restaurant._id}/kitchen/orders/${order._id}/items/${item._id}/status`)
      .set(authHeader(cook))
      .send({ status: 'cooking' });

    await request(app)
      .patch(`/api/${restaurant._id}/kitchen/orders/${order._id}/items/${item._id}/status`)
      .set(authHeader(cook))
      .send({ status: 'ready' });

    const updatedOrder = await Order.findById(order._id);
    expect(updatedOrder.status).toBe('open');
  });
});

describe('Stoplist (KDS)', () => {
  it('cook can add item to stoplist', async () => {
    const restaurant = await createRestaurant();
    const cook = await createStaff('cook', restaurant._id);
    const cat = await Category.create({ name: 'Тест', sortOrder: 1, restaurantId: restaurant._id });
    const item = await MenuItem.create({ name: 'Суп дня', basePrice: 90, categoryId: cat._id, restaurantId: restaurant._id, isAvailable: true });

    const res = await request(app)
      .post(`/api/${restaurant._id}/kitchen/stoplist/${item._id}`)
      .set(authHeader(cook));

    expect(res.status).toBe(200);
    expect(res.body.data.isAvailable).toBe(false);

    const updated = await MenuItem.findById(item._id);
    expect(updated.isAvailable).toBe(false);
  });

  it('cook can remove item from stoplist', async () => {
    const restaurant = await createRestaurant();
    const cook = await createStaff('cook', restaurant._id);
    const cat = await Category.create({ name: 'Тест', sortOrder: 1, restaurantId: restaurant._id });
    const item = await MenuItem.create({ name: 'Суп дня', basePrice: 90, categoryId: cat._id, restaurantId: restaurant._id, isAvailable: false });

    const res = await request(app)
      .delete(`/api/${restaurant._id}/kitchen/stoplist/${item._id}`)
      .set(authHeader(cook));

    expect(res.status).toBe(200);
    expect(res.body.data.isAvailable).toBe(true);
  });
});
