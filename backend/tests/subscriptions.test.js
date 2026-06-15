const request = require('supertest');
const app = require('../src/app');
const { connectTestDB, clearDB, disconnectTestDB } = require('./setup/db');
const { createRestaurant, createStaff, authHeader } = require('./setup/helpers');
const Restaurant = require('../src/models/Restaurant');
const { sign, encodeData } = require('../src/services/liqpayService');

beforeAll(() => connectTestDB());
afterEach(() => clearDB());
afterAll(() => disconnectTestDB());

/** Build a signed subscription webhook payload. */
function buildSubWebhookPayload(params) {
  const data = encodeData(params);
  const signature = sign(process.env.LIQPAY_PRIVATE_KEY, data);
  return { data, signature };
}

// ─── GET /price ───────────────────────────────────────────────────────────────

describe('GET /:restaurantId/subscriptions/price', () => {
  it('returns price info to any authenticated staff', async () => {
    const restaurant = await createRestaurant();
    const waiter = await createStaff('waiter', restaurant._id);

    const res = await request(app)
      .get(`/api/${restaurant._id}/subscriptions/price`)
      .set(authHeader(waiter));

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      amount: expect.any(Number),
      currency: 'UAH',
      periodicity: 'month',
    });
    expect(res.body.data.amount).toBeGreaterThan(0);
  });

  it('returns 401 for unauthenticated request', async () => {
    const restaurant = await createRestaurant();

    const res = await request(app)
      .get(`/api/${restaurant._id}/subscriptions/price`);

    expect(res.status).toBe(401);
  });
});

// ─── POST /initiate ───────────────────────────────────────────────────────────

describe('POST /:restaurantId/subscriptions/initiate', () => {
  it('returns signed LiqPay payload for admin', async () => {
    const restaurant = await createRestaurant();
    const admin = await createStaff('admin', restaurant._id);

    const res = await request(app)
      .post(`/api/${restaurant._id}/subscriptions/initiate`)
      .set(authHeader(admin));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('signature');
    expect(res.body.data).toHaveProperty('publicKey');
    expect(res.body.data.amount).toBeGreaterThan(0);
    expect(res.body.data.currency).toBe('UAH');

    const decoded = JSON.parse(Buffer.from(res.body.data.data, 'base64').toString('utf8'));
    expect(decoded.action).toBe('subscribe');
    expect(decoded.amount).toBeGreaterThan(0);
  });

  it('returns 403 for non-admin role', async () => {
    const restaurant = await createRestaurant();
    const cook = await createStaff('cook', restaurant._id);

    const res = await request(app)
      .post(`/api/${restaurant._id}/subscriptions/initiate`)
      .set(authHeader(cook));

    expect(res.status).toBe(403);
  });

  it('returns 401 for unauthenticated', async () => {
    const restaurant = await createRestaurant();

    const res = await request(app)
      .post(`/api/${restaurant._id}/subscriptions/initiate`);

    expect(res.status).toBe(401);
  });

  it('returns 403 if admin tries to access another restaurant', async () => {
    const restaurant1 = await createRestaurant({ name: 'R1', slug: 'r1' });
    const restaurant2 = await createRestaurant({ name: 'R2', slug: 'r2' });
    const admin1 = await createStaff('admin', restaurant1._id);

    const res = await request(app)
      .post(`/api/${restaurant2._id}/subscriptions/initiate`)
      .set(authHeader(admin1));

    expect(res.status).toBe(403);
  });
});

// ─── GET /status ──────────────────────────────────────────────────────────────

describe('GET /:restaurantId/subscriptions/status', () => {
  it('returns free plan info for free restaurant', async () => {
    const restaurant = await createRestaurant();
    const admin = await createStaff('admin', restaurant._id);

    const res = await request(app)
      .get(`/api/${restaurant._id}/subscriptions/status`)
      .set(authHeader(admin));

    expect(res.status).toBe(200);
    expect(res.body.data.plan).toBe('free');
    expect(res.body.data.subscriptionStartDate).toBeNull();
    expect(res.body.data.subscriptionEndDate).toBeNull();
    expect(res.body.data.subscriptionCancelled).toBe(false);
  });

  it('returns premium plan info with dates', async () => {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1);
    const restaurant = await createRestaurant({
      plan: 'premium',
      subscriptionStartDate: now,
      subscriptionEndDate: endDate,
      subscriptionCancelled: false,
    });
    const admin = await createStaff('admin', restaurant._id);

    const res = await request(app)
      .get(`/api/${restaurant._id}/subscriptions/status`)
      .set(authHeader(admin));

    expect(res.status).toBe(200);
    expect(res.body.data.plan).toBe('premium');
    expect(res.body.data.subscriptionStartDate).not.toBeNull();
    expect(res.body.data.subscriptionEndDate).not.toBeNull();
    expect(res.body.data.subscriptionCancelled).toBe(false);
  });

  it('returns 403 for non-admin', async () => {
    const restaurant = await createRestaurant();
    const waiter = await createStaff('waiter', restaurant._id);

    const res = await request(app)
      .get(`/api/${restaurant._id}/subscriptions/status`)
      .set(authHeader(waiter));

    expect(res.status).toBe(403);
  });

  it('returns 401 for unauthenticated', async () => {
    const restaurant = await createRestaurant();

    const res = await request(app)
      .get(`/api/${restaurant._id}/subscriptions/status`);

    expect(res.status).toBe(401);
  });
});

// ─── POST /cancel ─────────────────────────────────────────────────────────────

describe('POST /:restaurantId/subscriptions/cancel', () => {
  it('cancels auto-renewal for active premium subscription', async () => {
    const restaurant = await createRestaurant({
      plan: 'premium',
      subscriptionCancelled: false,
    });
    const admin = await createStaff('admin', restaurant._id);

    const res = await request(app)
      .post(`/api/${restaurant._id}/subscriptions/cancel`)
      .set(authHeader(admin));

    expect(res.status).toBe(200);
    expect(res.body.data.cancelled).toBe(true);

    const updated = await Restaurant.findById(restaurant._id).lean();
    expect(updated.subscriptionCancelled).toBe(true);
    expect(updated.plan).toBe('premium'); // plan stays premium until end date
  });

  it('returns 400 with NO_ACTIVE_SUBSCRIPTION if plan is free', async () => {
    const restaurant = await createRestaurant({ plan: 'free' });
    const admin = await createStaff('admin', restaurant._id);

    const res = await request(app)
      .post(`/api/${restaurant._id}/subscriptions/cancel`)
      .set(authHeader(admin));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NO_ACTIVE_SUBSCRIPTION');
  });

  it('returns 400 with ALREADY_CANCELLED if already cancelled', async () => {
    const restaurant = await createRestaurant({
      plan: 'premium',
      subscriptionCancelled: true,
    });
    const admin = await createStaff('admin', restaurant._id);

    const res = await request(app)
      .post(`/api/${restaurant._id}/subscriptions/cancel`)
      .set(authHeader(admin));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('ALREADY_CANCELLED');
  });

  it('returns 403 for non-admin', async () => {
    const restaurant = await createRestaurant({ plan: 'premium' });
    const waiter = await createStaff('waiter', restaurant._id);

    const res = await request(app)
      .post(`/api/${restaurant._id}/subscriptions/cancel`)
      .set(authHeader(waiter));

    expect(res.status).toBe(403);
  });
});

// ─── POST /subscriptions/webhook/liqpay ───────────────────────────────────────

describe('POST /api/subscriptions/webhook/liqpay', () => {
  it('rejects webhook with invalid signature', async () => {
    const res = await request(app)
      .post('/api/subscriptions/webhook/liqpay')
      .send({ data: 'someBase64Data', signature: 'wrong-sig' });

    expect(res.status).toBe(400);
  });

  it('returns 400 if data or signature are missing', async () => {
    const res = await request(app)
      .post('/api/subscriptions/webhook/liqpay')
      .send({ data: 'onlyData' });

    expect(res.status).toBe(400);
  });

  it('activates premium plan on subscribed status and sets dates', async () => {
    const restaurant = await createRestaurant({ plan: 'free' });
    const orderId = `sub_${restaurant._id}_${Date.now()}_abcd1234`;

    const { data, signature } = buildSubWebhookPayload({
      status: 'subscribed',
      order_id: orderId,
      transaction_id: 'sub-tx-001',
    });

    const res = await request(app)
      .post('/api/subscriptions/webhook/liqpay')
      .send({ data, signature });

    expect(res.status).toBe(200);

    const updated = await Restaurant.findById(restaurant._id).lean();
    expect(updated.plan).toBe('premium');
    expect(updated.subscriptionStartDate).toBeTruthy();
    expect(updated.subscriptionEndDate).toBeTruthy();
    expect(updated.subscriptionCancelled).toBe(false);

    const start = new Date(updated.subscriptionStartDate);
    const end   = new Date(updated.subscriptionEndDate);
    expect(end > start).toBe(true);
  });

  it('activates premium on sandbox status (test mode)', async () => {
    const restaurant = await createRestaurant({ plan: 'free' });
    const orderId = `sub_${restaurant._id}_${Date.now()}_ef012345`;

    const { data, signature } = buildSubWebhookPayload({
      status: 'sandbox',
      order_id: orderId,
    });

    const res = await request(app)
      .post('/api/subscriptions/webhook/liqpay')
      .send({ data, signature });

    expect(res.status).toBe(200);

    const updated = await Restaurant.findById(restaurant._id).lean();
    expect(updated.plan).toBe('premium');
  });

  it('deactivates premium on unsubscribed status and clears dates', async () => {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1);
    const restaurant = await createRestaurant({
      plan: 'premium',
      subscriptionStartDate: now,
      subscriptionEndDate: endDate,
    });
    const orderId = `sub_${restaurant._id}_${Date.now()}_gh678901`;

    const { data, signature } = buildSubWebhookPayload({
      status: 'unsubscribed',
      order_id: orderId,
    });

    const res = await request(app)
      .post('/api/subscriptions/webhook/liqpay')
      .send({ data, signature });

    expect(res.status).toBe(200);

    const updated = await Restaurant.findById(restaurant._id).lean();
    expect(updated.plan).toBe('free');
    expect(updated.subscriptionStartDate).toBeFalsy();
    expect(updated.subscriptionEndDate).toBeFalsy();
    expect(updated.subscriptionCancelled).toBe(false);
  });

  it('returns 200 for unknown order_id format (idempotent)', async () => {
    const { data, signature } = buildSubWebhookPayload({
      status: 'subscribed',
      order_id: 'unknown_order_format',
    });

    const res = await request(app)
      .post('/api/subscriptions/webhook/liqpay')
      .send({ data, signature });

    expect(res.status).toBe(200);
  });
});
