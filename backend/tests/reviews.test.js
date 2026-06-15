const request = require('supertest');
const app = require('../src/app');
const { connectTestDB, clearDB, disconnectTestDB } = require('./setup/db');
const { createRestaurant, createUser, createTable, createSession, createStaff, authHeader } = require('./setup/helpers');
const Category = require('../src/models/Category');
const MenuItem = require('../src/models/MenuItem');
const Order = require('../src/models/Order');
const OrderItem = require('../src/models/OrderItem');
const ServingGroup = require('../src/models/ServingGroup');

beforeAll(() => connectTestDB());
afterEach(() => clearDB());
afterAll(() => disconnectTestDB());

// ─── Helpers ──────────────────────────────────────────────────────────────────

let orderSeq = 0;
function nextOrderId() {
  orderSeq = (orderSeq + 1) % 100000000;
  return String(orderSeq).padStart(8, '0');
}

async function seedCompletedOrder(restaurantId, userId, status = 'completed_cash') {
  const cat = await Category.create({ name: 'Тест', sortOrder: 1, restaurantId });
  const menuItem = await MenuItem.create({ name: 'Піца', basePrice: 200, categoryId: cat._id, restaurantId, isAvailable: true });

  const table = await createTable(restaurantId);
  const session = await createSession(table._id, restaurantId);

  const orderId = nextOrderId();
  const order = await Order.create({
    _id: orderId,
    tableId: table._id,
    restaurantId,
    sessionToken: session.token,
    userId,
    status,
  });

  const servingGroup = await ServingGroup.create({ orderId: order._id, name: 'Основна подача', sortOrder: 0 });

  const orderItem = await OrderItem.create({
    orderId: order._id,
    servingGroupId: servingGroup._id,
    menuItemId: menuItem._id,
    quantity: 1,
    unitPrice: 200,
    name: 'Піца',
    status: 'served',
  });

  return { order, orderItem, menuItem };
}

// ─── GET /reviews/restaurant (public) ────────────────────────────────────────

describe('GET /:restaurantId/reviews/restaurant (public)', () => {
  it('returns empty list when no reviews', async () => {
    const restaurant = await createRestaurant();

    const res = await request(app)
      .get(`/api/${restaurant._id}/reviews/restaurant`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(0);
    expect(res.body.summary).toHaveProperty('averageRating');
    expect(res.body.summary).toHaveProperty('totalCount');
    expect(res.body.summary.totalCount).toBe(0);
  });

  it('returns paginated reviews with summary', async () => {
    const restaurant = await createRestaurant({ plan: 'premium' });
    const guest = await createUser({ role: 'guest', restaurantId: restaurant._id });
    const { order } = await seedCompletedOrder(restaurant._id, guest._id);

    await request(app)
      .post(`/api/${restaurant._id}/reviews/restaurant`)
      .set(authHeader(guest))
      .send({ orderId: order._id, rating: 5, comment: 'Excellent!' });

    const res = await request(app)
      .get(`/api/${restaurant._id}/reviews/restaurant`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].rating).toBe(5);
    expect(res.body.summary.averageRating).toBe(5);
    expect(res.body.summary.totalCount).toBe(1);
    expect(res.body.pagination).toHaveProperty('total', 1);
  });
});

// ─── GET /reviews/dish/:menuItemId (public) ───────────────────────────────────

describe('GET /:restaurantId/reviews/dish/:menuItemId (public)', () => {
  it('returns empty list when no dish reviews', async () => {
    const restaurant = await createRestaurant();
    const cat = await Category.create({ name: 'C', sortOrder: 1, restaurantId: restaurant._id });
    const item = await MenuItem.create({ name: 'Dish', basePrice: 100, categoryId: cat._id, restaurantId: restaurant._id, isAvailable: true });

    const res = await request(app)
      .get(`/api/${restaurant._id}/reviews/dish/${item._id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(0);
    expect(res.body.summary.totalCount).toBe(0);
  });

  it('returns 400 for invalid menuItemId', async () => {
    const restaurant = await createRestaurant();

    const res = await request(app)
      .get(`/api/${restaurant._id}/reviews/dish/not-a-valid-id`);

    expect(res.status).toBe(400);
  });
});

// ─── POST /reviews/restaurant ─────────────────────────────────────────────────

describe('POST /:restaurantId/reviews/restaurant', () => {
  it('guest can submit restaurant review on premium plan', async () => {
    const restaurant = await createRestaurant({ plan: 'premium' });
    const guest = await createUser({ role: 'guest', restaurantId: restaurant._id });
    const { order } = await seedCompletedOrder(restaurant._id, guest._id);

    const res = await request(app)
      .post(`/api/${restaurant._id}/reviews/restaurant`)
      .set(authHeader(guest))
      .send({ orderId: order._id, rating: 4, comment: 'Good food' });

    expect(res.status).toBe(201);
    expect(res.body.data.rating).toBe(4);
    expect(res.body.data.comment).toBe('Good food');
  });

  it('returns 403 on free plan', async () => {
    const restaurant = await createRestaurant({ plan: 'free' });
    const guest = await createUser({ role: 'guest', restaurantId: restaurant._id });
    const { order } = await seedCompletedOrder(restaurant._id, guest._id);

    const res = await request(app)
      .post(`/api/${restaurant._id}/reviews/restaurant`)
      .set(authHeader(guest))
      .send({ orderId: order._id, rating: 3 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PLAN_REQUIRED');
  });

  it('returns 404 when order does not exist', async () => {
    const restaurant = await createRestaurant({ plan: 'premium' });
    const guest = await createUser({ role: 'guest', restaurantId: restaurant._id });

    const res = await request(app)
      .post(`/api/${restaurant._id}/reviews/restaurant`)
      .set(authHeader(guest))
      .send({ orderId: '000000000000000000000000', rating: 4 });

    expect(res.status).toBe(404);
  });

  it('returns 404 if order does not belong to this user', async () => {
    const restaurant = await createRestaurant({ plan: 'premium' });
    const guest1 = await createUser({ role: 'guest', restaurantId: restaurant._id });
    const guest2 = await createUser({ role: 'guest', restaurantId: restaurant._id });
    const { order } = await seedCompletedOrder(restaurant._id, guest1._id);

    const res = await request(app)
      .post(`/api/${restaurant._id}/reviews/restaurant`)
      .set(authHeader(guest2))
      .send({ orderId: order._id, rating: 4 });

    expect(res.status).toBe(404);
  });

  it('returns 400 if rating is missing', async () => {
    const restaurant = await createRestaurant({ plan: 'premium' });
    const guest = await createUser({ role: 'guest', restaurantId: restaurant._id });
    const { order } = await seedCompletedOrder(restaurant._id, guest._id);

    const res = await request(app)
      .post(`/api/${restaurant._id}/reviews/restaurant`)
      .set(authHeader(guest))
      .send({ orderId: order._id });

    expect(res.status).toBe(400);
  });

  it('returns 400 if rating out of range', async () => {
    const restaurant = await createRestaurant({ plan: 'premium' });
    const guest = await createUser({ role: 'guest', restaurantId: restaurant._id });
    const { order } = await seedCompletedOrder(restaurant._id, guest._id);

    const res = await request(app)
      .post(`/api/${restaurant._id}/reviews/restaurant`)
      .set(authHeader(guest))
      .send({ orderId: order._id, rating: 6 });

    expect(res.status).toBe(400);
  });

  it('returns 401 for unauthenticated', async () => {
    const restaurant = await createRestaurant({ plan: 'premium' });

    const res = await request(app)
      .post(`/api/${restaurant._id}/reviews/restaurant`)
      .send({ orderId: '00000001', rating: 4 });

    expect(res.status).toBe(401);
  });

  it('returns 403 for staff role (only guests can review)', async () => {
    const restaurant = await createRestaurant({ plan: 'premium' });
    const admin = await createStaff('admin', restaurant._id);

    const res = await request(app)
      .post(`/api/${restaurant._id}/reviews/restaurant`)
      .set(authHeader(admin))
      .send({ orderId: '00000001', rating: 4 });

    expect(res.status).toBe(403);
  });
});

// ─── POST /reviews/dish ───────────────────────────────────────────────────────

describe('POST /:restaurantId/reviews/dish', () => {
  it('guest can submit dish review on premium plan', async () => {
    const restaurant = await createRestaurant({ plan: 'premium' });
    const guest = await createUser({ role: 'guest', restaurantId: restaurant._id });
    const { orderItem } = await seedCompletedOrder(restaurant._id, guest._id);

    const res = await request(app)
      .post(`/api/${restaurant._id}/reviews/dish`)
      .set(authHeader(guest))
      .send({ orderItemId: orderItem._id, rating: 5, comment: 'Amazing' });

    expect(res.status).toBe(201);
    expect(res.body.data.rating).toBe(5);
  });

  it('returns 403 on free plan', async () => {
    const restaurant = await createRestaurant({ plan: 'free' });
    const guest = await createUser({ role: 'guest', restaurantId: restaurant._id });
    const { orderItem } = await seedCompletedOrder(restaurant._id, guest._id);

    const res = await request(app)
      .post(`/api/${restaurant._id}/reviews/dish`)
      .set(authHeader(guest))
      .send({ orderItemId: orderItem._id, rating: 4 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PLAN_REQUIRED');
  });

  it('returns 400 if orderItemId is missing', async () => {
    const restaurant = await createRestaurant({ plan: 'premium' });
    const guest = await createUser({ role: 'guest', restaurantId: restaurant._id });

    const res = await request(app)
      .post(`/api/${restaurant._id}/reviews/dish`)
      .set(authHeader(guest))
      .send({ rating: 4 });

    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent orderItem', async () => {
    const restaurant = await createRestaurant({ plan: 'premium' });
    const guest = await createUser({ role: 'guest', restaurantId: restaurant._id });

    const res = await request(app)
      .post(`/api/${restaurant._id}/reviews/dish`)
      .set(authHeader(guest))
      .send({ orderItemId: '000000000000000000000000', rating: 4 });

    expect(res.status).toBe(404);
  });
});

// ─── GET /reviews/my/:orderId ─────────────────────────────────────────────────

describe('GET /:restaurantId/reviews/my/:orderId', () => {
  it('returns empty reviews for order with no reviews yet', async () => {
    const restaurant = await createRestaurant({ plan: 'premium' });
    const guest = await createUser({ role: 'guest', restaurantId: restaurant._id });
    const { order } = await seedCompletedOrder(restaurant._id, guest._id);

    const res = await request(app)
      .get(`/api/${restaurant._id}/reviews/my/${order._id}`)
      .set(authHeader(guest));

    expect(res.status).toBe(200);
    expect(res.body.data.restaurantReview).toBeNull();
    expect(Array.isArray(res.body.data.dishReviews)).toBe(true);
  });

  it('returns 404 if order does not belong to user', async () => {
    const restaurant = await createRestaurant({ plan: 'premium' });
    const guest1 = await createUser({ role: 'guest', restaurantId: restaurant._id });
    const guest2 = await createUser({ role: 'guest', restaurantId: restaurant._id });
    const { order } = await seedCompletedOrder(restaurant._id, guest1._id);

    const res = await request(app)
      .get(`/api/${restaurant._id}/reviews/my/${order._id}`)
      .set(authHeader(guest2));

    expect(res.status).toBe(404);
  });

  it('returns 401 for unauthenticated', async () => {
    const restaurant = await createRestaurant();

    const res = await request(app)
      .get(`/api/${restaurant._id}/reviews/my/000000000000000000000000`);

    expect(res.status).toBe(401);
  });
});
