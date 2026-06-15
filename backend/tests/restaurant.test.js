const request = require('supertest');
const app = require('../src/app');
const { connectTestDB, clearDB, disconnectTestDB } = require('./setup/db');
const { createRestaurant, createStaff, authHeader } = require('./setup/helpers');
const Restaurant = require('../src/models/Restaurant');

beforeAll(() => connectTestDB());
afterEach(() => clearDB());
afterAll(() => disconnectTestDB());

// ─── GET /admin/restaurant ────────────────────────────────────────────────────

describe('GET /:restaurantId/admin/restaurant', () => {
  it('returns restaurant info to authenticated staff', async () => {
    const restaurant = await createRestaurant({ name: 'My Restaurant' });
    const waiter = await createStaff('waiter', restaurant._id);

    const res = await request(app)
      .get(`/api/${restaurant._id}/admin/restaurant`)
      .set(authHeader(waiter));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('_id');
    expect(res.body.data.name).toBe('My Restaurant');
  });

  it('returns 403 for staff of a different restaurant', async () => {
    const restaurant1 = await createRestaurant({ name: 'R1', slug: 'r1' });
    const restaurant2 = await createRestaurant({ name: 'R2', slug: 'r2' });
    const waiter1 = await createStaff('waiter', restaurant1._id);

    const res = await request(app)
      .get(`/api/${restaurant2._id}/admin/restaurant`)
      .set(authHeader(waiter1));

    expect(res.status).toBe(403);
  });

  it('returns 401 for unauthenticated', async () => {
    const restaurant = await createRestaurant();

    const res = await request(app)
      .get(`/api/${restaurant._id}/admin/restaurant`);

    expect(res.status).toBe(401);
  });
});

// ─── PUT /admin/restaurant ────────────────────────────────────────────────────

describe('PUT /:restaurantId/admin/restaurant', () => {
  it('admin can update restaurant slug', async () => {
    const restaurant = await createRestaurant({ slug: 'old-slug' });
    const admin = await createStaff('admin', restaurant._id);

    const res = await request(app)
      .put(`/api/${restaurant._id}/admin/restaurant`)
      .set(authHeader(admin))
      .send({ slug: 'new-slug' });

    expect(res.status).toBe(200);
    expect(res.body.data.slug).toBe('new-slug');

    const updated = await Restaurant.findById(restaurant._id).lean();
    expect(updated.slug).toBe('new-slug');
  });

  it('admin can update restaurant name', async () => {
    const restaurant = await createRestaurant({ name: 'Old Name' });
    const admin = await createStaff('admin', restaurant._id);

    const res = await request(app)
      .put(`/api/${restaurant._id}/admin/restaurant`)
      .set(authHeader(admin))
      .send({ name: 'New Name' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('New Name');
  });

  it('admin can update defaultLanguage', async () => {
    const restaurant = await createRestaurant();
    const admin = await createStaff('admin', restaurant._id);

    const res = await request(app)
      .put(`/api/${restaurant._id}/admin/restaurant`)
      .set(authHeader(admin))
      .send({ defaultLanguage: 'en' });

    expect(res.status).toBe(200);
    expect(res.body.data.defaultLanguage).toBe('en');
  });

  it('returns 403 for non-admin (waiter)', async () => {
    const restaurant = await createRestaurant();
    const waiter = await createStaff('waiter', restaurant._id);

    const res = await request(app)
      .put(`/api/${restaurant._id}/admin/restaurant`)
      .set(authHeader(waiter))
      .send({ slug: 'hacked' });

    expect(res.status).toBe(403);
  });

  it('returns 401 for unauthenticated', async () => {
    const restaurant = await createRestaurant();

    const res = await request(app)
      .put(`/api/${restaurant._id}/admin/restaurant`)
      .send({ slug: 'hacked' });

    expect(res.status).toBe(401);
  });
});

// ─── GET /admin/restaurant/liqpay ─────────────────────────────────────────────

describe('GET /:restaurantId/admin/restaurant/liqpay', () => {
  it('returns null publicKey and hasPrivateKey=false when no keys stored', async () => {
    const restaurant = await createRestaurant();
    const admin = await createStaff('admin', restaurant._id);

    const res = await request(app)
      .get(`/api/${restaurant._id}/admin/restaurant/liqpay`)
      .set(authHeader(admin));

    expect(res.status).toBe(200);
    expect(res.body.data.publicKey).toBeNull();
    expect(res.body.data.hasPrivateKey).toBe(false);
  });

  it('returns 403 for non-admin', async () => {
    const restaurant = await createRestaurant();
    const cook = await createStaff('cook', restaurant._id);

    const res = await request(app)
      .get(`/api/${restaurant._id}/admin/restaurant/liqpay`)
      .set(authHeader(cook));

    expect(res.status).toBe(403);
  });

  it('returns 401 for unauthenticated', async () => {
    const restaurant = await createRestaurant();

    const res = await request(app)
      .get(`/api/${restaurant._id}/admin/restaurant/liqpay`);

    expect(res.status).toBe(401);
  });
});

// ─── PUT /admin/restaurant/liqpay ─────────────────────────────────────────────

describe('PUT /:restaurantId/admin/restaurant/liqpay', () => {
  it('saves LiqPay keys and returns saved=true', async () => {
    const restaurant = await createRestaurant();
    const admin = await createStaff('admin', restaurant._id);

    const res = await request(app)
      .put(`/api/${restaurant._id}/admin/restaurant/liqpay`)
      .set(authHeader(admin))
      .send({ publicKey: 'sandbox_pub_123', privateKey: 'sandbox_priv_456' });

    expect(res.status).toBe(200);
    expect(res.body.data.saved).toBe(true);

    const updated = await Restaurant.findById(restaurant._id).lean();
    expect(updated.liqpayPublicKey).toBe('sandbox_pub_123');
    expect(updated.liqpayPrivateKeyEnc).toBeTruthy();
  });

  it('returns 400 if publicKey is missing', async () => {
    const restaurant = await createRestaurant();
    const admin = await createStaff('admin', restaurant._id);

    const res = await request(app)
      .put(`/api/${restaurant._id}/admin/restaurant/liqpay`)
      .set(authHeader(admin))
      .send({ privateKey: 'priv_only' });

    expect(res.status).toBe(400);
  });

  it('returns 400 if privateKey is missing', async () => {
    const restaurant = await createRestaurant();
    const admin = await createStaff('admin', restaurant._id);

    const res = await request(app)
      .put(`/api/${restaurant._id}/admin/restaurant/liqpay`)
      .set(authHeader(admin))
      .send({ publicKey: 'pub_only' });

    expect(res.status).toBe(400);
  });

  it('returns 403 for non-admin', async () => {
    const restaurant = await createRestaurant();
    const waiter = await createStaff('waiter', restaurant._id);

    const res = await request(app)
      .put(`/api/${restaurant._id}/admin/restaurant/liqpay`)
      .set(authHeader(waiter))
      .send({ publicKey: 'pub', privateKey: 'priv' });

    expect(res.status).toBe(403);
  });

  it('returns 401 for unauthenticated', async () => {
    const restaurant = await createRestaurant();

    const res = await request(app)
      .put(`/api/${restaurant._id}/admin/restaurant/liqpay`)
      .send({ publicKey: 'pub', privateKey: 'priv' });

    expect(res.status).toBe(401);
  });
});
