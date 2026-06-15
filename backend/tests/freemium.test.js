/**
 * Freemium plan limit tests.
 * Verifies that free-plan restaurants hit the correct limits and premium
 * restaurants are unrestricted.
 */

const request = require('supertest');
const app = require('../src/app');
const { connectTestDB, clearDB, disconnectTestDB } = require('./setup/db');
const { createRestaurant, createStaff, authHeader } = require('./setup/helpers');
const Category = require('../src/models/Category');
const MenuItem = require('../src/models/MenuItem');
const User = require('../src/models/User');

beforeAll(() => connectTestDB());
afterEach(() => clearDB());
afterAll(() => disconnectTestDB());

// ─── Category limit (5) ───────────────────────────────────────────────────────

describe('Free plan: category limit', () => {
  it('allows creating up to 5 categories', async () => {
    const restaurant = await createRestaurant({ plan: 'free' });
    const admin = await createStaff('admin', restaurant._id);

    for (let i = 1; i <= 5; i++) {
      const res = await request(app)
        .post(`/api/${restaurant._id}/admin/menu/categories`)
        .set(authHeader(admin))
        .send({ name: `Category ${i}`, sortOrder: i });
      expect(res.status).toBe(201);
    }
  });

  it('blocks creating the 6th category on free plan', async () => {
    const restaurant = await createRestaurant({ plan: 'free' });
    const admin = await createStaff('admin', restaurant._id);

    // Create 5 directly in DB to avoid 5 HTTP round-trips
    const existing = Array.from({ length: 5 }, (_, i) =>
      ({ name: `Cat ${i}`, sortOrder: i, restaurantId: restaurant._id, isDeleted: false })
    );
    await Category.insertMany(existing);

    const res = await request(app)
      .post(`/api/${restaurant._id}/admin/menu/categories`)
      .set(authHeader(admin))
      .send({ name: 'Sixth Category', sortOrder: 6 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PLAN_LIMIT_REACHED');
    expect(res.body.error.limitType).toBe('categories');
    expect(res.body.error.limit).toBe(5);
  });

  it('premium plan allows more than 5 categories', async () => {
    const restaurant = await createRestaurant({ plan: 'premium' });
    const admin = await createStaff('admin', restaurant._id);

    const existing = Array.from({ length: 5 }, (_, i) =>
      ({ name: `Cat ${i}`, sortOrder: i, restaurantId: restaurant._id, isDeleted: false })
    );
    await Category.insertMany(existing);

    const res = await request(app)
      .post(`/api/${restaurant._id}/admin/menu/categories`)
      .set(authHeader(admin))
      .send({ name: 'Sixth Category', sortOrder: 6 });

    expect(res.status).toBe(201);
  });
});

// ─── Menu item limit (50) ─────────────────────────────────────────────────────

describe('Free plan: menu item limit', () => {
  it('blocks creating the 51st item on free plan', async () => {
    const restaurant = await createRestaurant({ plan: 'free' });
    const admin = await createStaff('admin', restaurant._id);
    const cat = await Category.create({ name: 'Cat', sortOrder: 1, restaurantId: restaurant._id });

    // Insert 50 items directly to skip HTTP round-trips
    const items = Array.from({ length: 50 }, (_, i) => ({
      name: `Item ${i}`,
      basePrice: 100,
      categoryId: cat._id,
      restaurantId: restaurant._id,
      isAvailable: true,
      isDeleted: false,
    }));
    await MenuItem.insertMany(items);

    const res = await request(app)
      .post(`/api/${restaurant._id}/admin/menu/items`)
      .set(authHeader(admin))
      .send({ name: 'Item 51', price: 120, categoryId: cat._id });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PLAN_LIMIT_REACHED');
    expect(res.body.error.limitType).toBe('items');
    expect(res.body.error.limit).toBe(50);
  });

  it('premium plan allows more than 50 items', async () => {
    const restaurant = await createRestaurant({ plan: 'premium' });
    const admin = await createStaff('admin', restaurant._id);
    const cat = await Category.create({ name: 'Cat', sortOrder: 1, restaurantId: restaurant._id });

    const items = Array.from({ length: 50 }, (_, i) => ({
      name: `Item ${i}`,
      basePrice: 100,
      categoryId: cat._id,
      restaurantId: restaurant._id,
      isAvailable: true,
      isDeleted: false,
    }));
    await MenuItem.insertMany(items);

    const res = await request(app)
      .post(`/api/${restaurant._id}/admin/menu/items`)
      .set(authHeader(admin))
      .send({ name: 'Item 51', price: 120, categoryId: cat._id });

    expect(res.status).toBe(201);
  });
});

// ─── Staff limit (3) ─────────────────────────────────────────────────────────

describe('Free plan: staff limit', () => {
  it('blocks creating the 4th staff account on free plan', async () => {
    const restaurant = await createRestaurant({ plan: 'free' });
    const admin = await createStaff('admin', restaurant._id);

    // admin is already #1; add 2 more to reach the limit of 3
    await createStaff('waiter', restaurant._id);
    await createStaff('cook', restaurant._id);

    const res = await request(app)
      .post(`/api/${restaurant._id}/admin/staff`)
      .set(authHeader(admin))
      .send({ email: `new-staff-${Date.now()}@example.com`, name: 'Extra Staff', role: 'waiter' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PLAN_LIMIT_REACHED');
    expect(res.body.error.limitType).toBe('staff');
    expect(res.body.error.limit).toBe(3);
  });

  it('allows creating a 4th staff account on premium plan', async () => {
    const restaurant = await createRestaurant({ plan: 'premium' });
    const admin = await createStaff('admin', restaurant._id);

    await createStaff('waiter', restaurant._id);
    await createStaff('cook', restaurant._id);

    const res = await request(app)
      .post(`/api/${restaurant._id}/admin/staff`)
      .set(authHeader(admin))
      .send({ email: `new-staff-${Date.now()}@example.com`, name: 'Extra Staff', role: 'waiter' });

    expect(res.status).toBe(201);
  });
});

// ─── Analytics: premium-gated ─────────────────────────────────────────────────

describe('Free plan: analytics access', () => {
  it('returns 403 for admin on free plan', async () => {
    const restaurant = await createRestaurant({ plan: 'free' });
    const admin = await createStaff('admin', restaurant._id);

    const res = await request(app)
      .get(`/api/${restaurant._id}/admin/analytics/revenue`)
      .set(authHeader(admin));

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PLAN_REQUIRED');
  });

  it('returns 200 for admin on premium plan', async () => {
    const restaurant = await createRestaurant({ plan: 'premium' });
    const admin = await createStaff('admin', restaurant._id);

    const res = await request(app)
      .get(`/api/${restaurant._id}/admin/analytics/revenue`)
      .set(authHeader(admin));

    expect(res.status).toBe(200);
  });
});
