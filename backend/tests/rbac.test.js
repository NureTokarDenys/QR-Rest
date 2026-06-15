const request = require('supertest');
const app = require('../src/app');
const { connectTestDB, clearDB, disconnectTestDB } = require('./setup/db');
const { createRestaurant, createStaff, authHeader } = require('./setup/helpers');

beforeAll(() => connectTestDB());
afterEach(() => clearDB());
afterAll(() => disconnectTestDB());

describe('RBAC — cross-restaurant isolation', () => {
  it('admin cannot access another restaurant tables (HTTP 403)', async () => {
    const restaurant1 = await createRestaurant({ name: 'Ресторан 1', slug: 'rest-1' });
    const restaurant2 = await createRestaurant({ name: 'Ресторан 2', slug: 'rest-2' });
    const admin1 = await createStaff('admin', restaurant1._id);

    // admin1 tries to query restaurant2's data — requireSameRestaurant should reject
    const res = await request(app)
      .get(`/api/${restaurant2._id}/admin/tables`)
      .set(authHeader(admin1));

    expect(res.status).toBe(403);
  });

  it('cook cannot access admin routes', async () => {
    const restaurant = await createRestaurant();
    const cook = await createStaff('cook', restaurant._id);

    const res = await request(app)
      .get(`/api/${restaurant._id}/admin/analytics/revenue`)
      .set(authHeader(cook));

    expect(res.status).toBe(403);
  });

  it('waiter cannot access kitchen stoplist management', async () => {
    const restaurant = await createRestaurant();
    const waiter = await createStaff('waiter', restaurant._id);

    const res = await request(app)
      .get(`/api/${restaurant._id}/kitchen/stoplist`)
      .set(authHeader(waiter));

    expect(res.status).toBe(403);
  });

  it('unauthenticated request to protected route returns 401', async () => {
    const restaurant = await createRestaurant();
    const res = await request(app).get(`/api/${restaurant._id}/waiter/orders`);
    expect(res.status).toBe(401);
  });
});

describe('RBAC — role-specific access', () => {
  it('cook can access kitchen orders', async () => {
    const restaurant = await createRestaurant();
    const cook = await createStaff('cook', restaurant._id);

    const res = await request(app)
      .get(`/api/${restaurant._id}/kitchen/orders`)
      .set(authHeader(cook));

    expect(res.status).toBe(200);
  });

  it('waiter can access waiter orders', async () => {
    const restaurant = await createRestaurant();
    const waiter = await createStaff('waiter', restaurant._id);

    const res = await request(app)
      .get(`/api/${restaurant._id}/waiter/orders`)
      .set(authHeader(waiter));

    expect(res.status).toBe(200);
  });

  it('admin can access admin analytics on premium plan', async () => {
    const restaurant = await createRestaurant({ plan: 'premium' });
    const admin = await createStaff('admin', restaurant._id);

    const res = await request(app)
      .get(`/api/${restaurant._id}/admin/analytics/revenue`)
      .set(authHeader(admin));

    expect(res.status).toBe(200);
  });
});
