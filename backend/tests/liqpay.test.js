/**
 * LiqPay payment integration tests.
 *
 * The webhook handler tests can be run against the in-memory DB without real
 * LiqPay credentials, because the signature is computed locally with the test
 * keys from env.js and the same keys are stored (encrypted) on the restaurant.
 *
 * The payment-initiation tests generate the signed payload — no HTTP call to
 * LiqPay is made. Keys must be configured on the restaurant first.
 */

const request = require('supertest');
const app = require('../src/app');
const { connectTestDB, clearDB, disconnectTestDB } = require('./setup/db');
const { createRestaurant, createTable, createSession, createStaff, authHeader } = require('./setup/helpers');
const Category = require('../src/models/Category');
const MenuItem = require('../src/models/MenuItem');
const Order = require('../src/models/Order');
const Payment = require('../src/models/Payment');
const Restaurant = require('../src/models/Restaurant');
const { sign, encodeData } = require('../src/services/liqpayService');
const { encrypt } = require('../src/services/encryptionService');

beforeAll(() => connectTestDB());
afterEach(() => clearDB());
afterAll(() => disconnectTestDB());

// ─── helpers ────────────────────────────────────────────────────────────────

const TEST_PUBLIC_KEY  = process.env.LIQPAY_PUBLIC_KEY;
const TEST_PRIVATE_KEY = process.env.LIQPAY_PRIVATE_KEY;

/** Persist encrypted LiqPay keys on a restaurant (required for payments/initiate and webhook). */
async function setLiqpayKeys(restaurantId, publicKey = TEST_PUBLIC_KEY, privateKey = TEST_PRIVATE_KEY) {
  const { iv, ciphertext, authTag } = encrypt(privateKey);
  await Restaurant.findByIdAndUpdate(restaurantId, {
    liqpayPublicKey:     publicKey,
    liqpayPrivateKeyEnc: ciphertext,
    liqpayPrivateKeyIV:  iv,
    liqpayPrivateKeyTag: authTag,
  });
}

async function seedOrder(restaurantId, tableId, sessionToken) {
  const cat = await Category.create({ name: 'Тест', sortOrder: 1, restaurantId });
  const menuItem = await MenuItem.create({ name: 'Піца', basePrice: 200, categoryId: cat._id, restaurantId, isAvailable: true });

  const orderRes = await request(app)
    .post(`/api/${restaurantId}/orders`)
    .send({ tableId, sessionToken, items: [{ menuItemId: menuItem._id, qty: 1 }] });

  return orderRes.body.data.order;
}

/** Build a signed LiqPay webhook payload as LiqPay would send it. */
function buildWebhookPayload(params, privateKey = TEST_PRIVATE_KEY) {
  const data = encodeData(params);
  const signature = sign(privateKey, data);
  return { data, signature };
}

// ─── Payment initiation ──────────────────────────────────────────────────────

describe('POST /api/:restaurantId/payments/initiate — LiqPay online payment', () => {
  it('returns signed LiqPay payload for a valid order', async () => {
    const restaurant = await createRestaurant();
    await setLiqpayKeys(restaurant._id);
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);
    const order = await seedOrder(restaurant._id, table._id, session.token);

    const res = await request(app)
      .post(`/api/${restaurant._id}/payments/initiate`)
      .set('Cookie', `session_token=${session.token}`)
      .send({ orderId: order._id });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('signature');
    expect(res.body.data).toHaveProperty('publicKey');

    const decoded = JSON.parse(Buffer.from(res.body.data.data, 'base64').toString('utf8'));
    expect(decoded.action).toBe('pay');
    expect(decoded.currency).toBe('UAH');
    expect(decoded.amount).toBeGreaterThan(0);
  });

  it('returns 400 if LiqPay keys are not configured', async () => {
    const restaurant = await createRestaurant(); // no keys
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);
    const order = await seedOrder(restaurant._id, table._id, session.token);

    const res = await request(app)
      .post(`/api/${restaurant._id}/payments/initiate`)
      .set('Cookie', `session_token=${session.token}`)
      .send({ orderId: order._id });

    expect(res.status).toBe(400);
  });

  it('returns 400 if order is already completed_cash', async () => {
    const restaurant = await createRestaurant();
    await setLiqpayKeys(restaurant._id);
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);
    const order = await seedOrder(restaurant._id, table._id, session.token);

    await Order.findByIdAndUpdate(order._id, { status: 'completed_cash' });

    const res = await request(app)
      .post(`/api/${restaurant._id}/payments/initiate`)
      .set('Cookie', `session_token=${session.token}`)
      .send({ orderId: order._id });

    expect(res.status).toBe(400);
  });

  it('returns 400 if order is already completed_epay', async () => {
    const restaurant = await createRestaurant();
    await setLiqpayKeys(restaurant._id);
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);
    const order = await seedOrder(restaurant._id, table._id, session.token);

    await Order.findByIdAndUpdate(order._id, { status: 'completed_epay' });

    const res = await request(app)
      .post(`/api/${restaurant._id}/payments/initiate`)
      .set('Cookie', `session_token=${session.token}`)
      .send({ orderId: order._id });

    expect(res.status).toBe(400);
  });

  it('returns 400 if orderId is missing', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);

    const res = await request(app)
      .post(`/api/${restaurant._id}/payments/initiate`)
      .set('Cookie', `session_token=${session.token}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

// ─── LiqPay webhook handler ──────────────────────────────────────────────────
// Payment webhook is mounted at /api/payments/webhook/liqpay/:restaurantId

describe('POST /api/payments/webhook/liqpay/:restaurantId — webhook handler', () => {
  it('returns 400 if data or signature fields are missing', async () => {
    const restaurant = await createRestaurant();
    await setLiqpayKeys(restaurant._id);

    const res = await request(app)
      .post(`/api/payments/webhook/liqpay/${restaurant._id}`)
      .send({ data: 'onlyData' }); // no signature

    expect(res.status).toBe(400);
  });

  it('rejects webhook with invalid signature (returns 400)', async () => {
    const restaurant = await createRestaurant();
    await setLiqpayKeys(restaurant._id);

    const res = await request(app)
      .post(`/api/payments/webhook/liqpay/${restaurant._id}`)
      .send({ data: 'someBase64Data', signature: 'wrong-signature' });

    expect(res.status).toBe(400);
  });

  it('returns 400 if restaurant has no LiqPay keys configured', async () => {
    const restaurant = await createRestaurant(); // no keys

    const { data, signature } = buildWebhookPayload({ status: 'success', order_id: 'some-id' });

    const res = await request(app)
      .post(`/api/payments/webhook/liqpay/${restaurant._id}`)
      .send({ data, signature });

    expect(res.status).toBe(400);
  });

  it('successful online payment: moves order to open_paid', async () => {
    const restaurant = await createRestaurant();
    await setLiqpayKeys(restaurant._id);
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);
    const order = await seedOrder(restaurant._id, table._id, session.token);

    const payment = await Payment.create({
      orderId: order._id,
      restaurantId: restaurant._id,
      amount: 200,
      method: 'online',
    });

    const { data, signature } = buildWebhookPayload({
      status: 'success',
      order_id: payment._id.toString(),
      transaction_id: 'liqpay-tx-001',
    });

    const res = await request(app)
      .post(`/api/payments/webhook/liqpay/${restaurant._id}`)
      .send({ data, signature });

    expect(res.status).toBe(200);

    const updatedOrder = await Order.findById(order._id);
    // After payment success the order moves to open_paid (kitchen keeps working),
    // then auto-finalizes to completed_epay when all dishes are served.
    expect(['open_paid', 'completed_epay']).toContain(updatedOrder.status);
    expect(updatedOrder.liqpayData.transactionId).toBe('liqpay-tx-001');

    const updatedPayment = await Payment.findById(payment._id);
    expect(updatedPayment.status).toBe('completed');
    expect(updatedPayment.liqpayTransactionId).toBe('liqpay-tx-001');
  });

  it('failed online payment: does NOT change order status', async () => {
    const restaurant = await createRestaurant();
    await setLiqpayKeys(restaurant._id);
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);
    const order = await seedOrder(restaurant._id, table._id, session.token);

    const payment = await Payment.create({
      orderId: order._id,
      restaurantId: restaurant._id,
      amount: 200,
      method: 'online',
    });

    const { data, signature } = buildWebhookPayload({
      status: 'failure',
      order_id: payment._id.toString(),
      err_description: 'Insufficient funds',
    });

    const res = await request(app)
      .post(`/api/payments/webhook/liqpay/${restaurant._id}`)
      .send({ data, signature });

    expect(res.status).toBe(200);

    const updatedOrder = await Order.findById(order._id);
    expect(updatedOrder.status).toBe('open'); // unchanged — order stays open on payment failure

    const updatedPayment = await Payment.findById(payment._id);
    expect(updatedPayment.status).toBe('failed');
  });

  it('returns 200 (idempotent) for unknown payment ID — avoids LiqPay retries', async () => {
    const restaurant = await createRestaurant();
    await setLiqpayKeys(restaurant._id);

    const { data, signature } = buildWebhookPayload({
      status: 'success',
      order_id: '000000000000000000000000', // non-existent payment
    });

    const res = await request(app)
      .post(`/api/payments/webhook/liqpay/${restaurant._id}`)
      .send({ data, signature });

    // Webhook must always return 200 to stop LiqPay from retrying
    expect(res.status).toBe(200);
  });
});
