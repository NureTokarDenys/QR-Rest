/**
 * tests/onboarding.test.js
 *
 * Integration tests for the onboarding HTTP endpoints.
 * Resend is mocked — no real emails are sent.
 * Database uses MongoMemoryServer (wired up via globalSetup).
 *
 * Covers:
 *   POST /api/onboarding/register
 *     ✓ 201 on valid input
 *     ✓ 400 missing fields
 *     ✓ 400 invalid email
 *     ✓ 409 duplicate pending request for same email
 *     ✓ 409 email already registered as a user
 *
 *   GET /api/onboarding/confirm/:token
 *     ✓ 200 creates Restaurant + admin User + sends credentials email
 *     ✓ created User has role admin and correct restaurantId
 *     ✓ 5 default tables are seeded
 *     ✓ 404 unknown token
 *     ✓ 409 token already confirmed
 *     ✓ 410 expired token
 */

'use strict';

const request = require('supertest');

// ─── Mock Resend before app is loaded ────────────────────────────────────────

const mockSend = jest.fn().mockResolvedValue({ data: { id: 'mock_id' }, error: null });

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

const app                = require('../src/app');
const { connectTestDB, clearDB, disconnectTestDB } = require('./setup/db');
const OnboardingRequest  = require('../src/models/OnboardingRequest');
const Restaurant         = require('../src/models/Restaurant');
const User               = require('../src/models/User');
const Table              = require('../src/models/Table');

// ─── lifecycle ───────────────────────────────────────────────────────────────

beforeAll(() => connectTestDB());
afterEach(async () => { await clearDB(); mockSend.mockClear(); });
afterAll(() => disconnectTestDB());

// ─── helpers ─────────────────────────────────────────────────────────────────

const REGISTER_URL = '/api/onboarding/register';
const CONFIRM_BASE = '/api/onboarding/confirm';

const VALID_BODY = {
  email:          'owner@example.com',
  ownerName:      'Іван Франко',
  restaurantName: 'Борщечок',
};

async function registerAndGetToken(body = VALID_BODY) {
  await request(app).post(REGISTER_URL).send(body);
  const req = await OnboardingRequest.findOne({ email: body.email.toLowerCase() });
  return req.token;
}

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/onboarding/register
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/onboarding/register', () => {

  it('returns 201 and sends a confirmation email on valid input', async () => {
    const res = await request(app).post(REGISTER_URL).send(VALID_BODY);

    expect(res.status).toBe(201);
    expect(res.body.data.message).toMatch(/confirmation email sent/i);

    // One email dispatched
    expect(mockSend).toHaveBeenCalledTimes(1);
    const emailCall = mockSend.mock.calls[0][0];
    expect(emailCall.to).toBe(VALID_BODY.email);
    expect(emailCall.subject).toContain(VALID_BODY.restaurantName);
  });

  it('creates an OnboardingRequest document in the database', async () => {
    await request(app).post(REGISTER_URL).send(VALID_BODY);

    const doc = await OnboardingRequest.findOne({ email: VALID_BODY.email });
    expect(doc).not.toBeNull();
    expect(doc.status).toBe('pending');
    expect(doc.ownerName).toBe(VALID_BODY.ownerName);
    expect(doc.restaurantName).toBe(VALID_BODY.restaurantName);
    expect(doc.token).toBeTruthy();
    expect(doc.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app).post(REGISTER_URL).send({ ownerName: 'X', restaurantName: 'Y' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when ownerName is missing', async () => {
    const res = await request(app).post(REGISTER_URL).send({ email: 'a@b.com', restaurantName: 'Y' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when restaurantName is missing', async () => {
    const res = await request(app).post(REGISTER_URL).send({ email: 'a@b.com', ownerName: 'X' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid email format', async () => {
    const res = await request(app).post(REGISTER_URL).send({
      email: 'not-an-email', ownerName: 'X', restaurantName: 'Y',
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when ownerName is too short', async () => {
    const res = await request(app).post(REGISTER_URL).send({
      email: 'a@b.com', ownerName: 'X', restaurantName: 'Y',
    });
    expect(res.status).toBe(400);
  });

  it('returns 409 ONBOARDING_PENDING when a pending request already exists', async () => {
    // First request
    await request(app).post(REGISTER_URL).send(VALID_BODY);
    mockSend.mockClear();

    // Duplicate
    const res = await request(app).post(REGISTER_URL).send(VALID_BODY);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ONBOARDING_PENDING');

    // No email sent for the duplicate
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('returns 409 EMAIL_TAKEN when the email already belongs to a registered user', async () => {
    await User.create({
      name:         'Existing',
      email:        VALID_BODY.email,
      passwordHash: await User.hashPassword('Password123!'),
      role:         'guest',
    });

    const res = await request(app).post(REGISTER_URL).send(VALID_BODY);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('is case-insensitive for email deduplication', async () => {
    await request(app).post(REGISTER_URL).send(VALID_BODY);
    mockSend.mockClear();

    const res = await request(app).post(REGISTER_URL).send({
      ...VALID_BODY,
      email: VALID_BODY.email.toUpperCase(),
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ONBOARDING_PENDING');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/onboarding/confirm/:token
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/onboarding/confirm/:token', () => {

  it('returns 200 and confirms the request on a valid token', async () => {
    const token = await registerAndGetToken();
    const res   = await request(app).get(`${CONFIRM_BASE}/${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.restaurantId).toBeTruthy();
    expect(res.body.data.restaurantName).toBe(VALID_BODY.restaurantName);
  });

  it('marks the OnboardingRequest as confirmed', async () => {
    const token = await registerAndGetToken();
    await request(app).get(`${CONFIRM_BASE}/${token}`);

    const doc = await OnboardingRequest.findOne({ token });
    expect(doc.status).toBe('confirmed');
  });

  it('creates a Restaurant document', async () => {
    const token = await registerAndGetToken();
    const res   = await request(app).get(`${CONFIRM_BASE}/${token}`);

    const rid = res.body.data.restaurantId;
    const restaurant = await Restaurant.findById(rid);
    expect(restaurant).not.toBeNull();
    expect(restaurant.name).toBe(VALID_BODY.restaurantName);
  });

  it('creates an admin User with the correct restaurantId and email', async () => {
    const token = await registerAndGetToken();
    const res   = await request(app).get(`${CONFIRM_BASE}/${token}`);

    const rid  = res.body.data.restaurantId;
    const user = await User.findOne({ email: VALID_BODY.email });
    expect(user).not.toBeNull();
    expect(user.role).toBe('admin');
    expect(user.restaurantId).toBe(rid);
  });

  it('admin User password is valid and hashed (not stored in plain text)', async () => {
    const token = await registerAndGetToken();
    await request(app).get(`${CONFIRM_BASE}/${token}`);

    const user = await User.findOne({ email: VALID_BODY.email }).select('+passwordHash');
    expect(user.passwordHash).toBeTruthy();
    expect(user.passwordHash).not.toMatch(/^[A-Za-z0-9!@#$%&*]{14}$/); // not plain text
    expect(user.passwordHash.startsWith('$2b$')).toBe(true); // bcrypt hash
  });

  it('seeds 5 default tables for the new restaurant', async () => {
    const token = await registerAndGetToken();
    const res   = await request(app).get(`${CONFIRM_BASE}/${token}`);

    const rid    = res.body.data.restaurantId;
    const tables = await Table.find({ restaurantId: rid });
    expect(tables).toHaveLength(5);
    const numbers = tables.map((t) => t.number).sort((a, b) => a - b);
    expect(numbers).toEqual([1, 2, 3, 4, 5]);
  });

  it('sends a credentials email after confirmation', async () => {
    mockSend.mockClear();
    const token = await registerAndGetToken();
    // registerAndGetToken() already called register → 1 call for confirmation
    mockSend.mockClear();

    await request(app).get(`${CONFIRM_BASE}/${token}`);
    expect(mockSend).toHaveBeenCalledTimes(1);

    const emailCall = mockSend.mock.calls[0][0];
    expect(emailCall.to).toBe(VALID_BODY.email);
  });

  it('returns 404 for an unknown token', async () => {
    const res = await request(app).get(`${CONFIRM_BASE}/nonexistenttoken000`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('returns 409 ALREADY_CONFIRMED when the token was already used', async () => {
    const token = await registerAndGetToken();
    await request(app).get(`${CONFIRM_BASE}/${token}`);

    const res = await request(app).get(`${CONFIRM_BASE}/${token}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_CONFIRMED');
  });

  it('returns 410 TOKEN_EXPIRED for an expired request', async () => {
    // Create an expired OnboardingRequest directly
    await OnboardingRequest.create({
      email:          'expired@example.com',
      ownerName:      'Expired Owner',
      restaurantName: 'Expired Cafe',
      token:          'expiredtoken123',
      expiresAt:      new Date(Date.now() - 1000), // 1 second in the past
      status:         'pending',
    });

    const res = await request(app).get(`${CONFIRM_BASE}/expiredtoken123`);
    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('does not create duplicate restaurants on repeated confirm attempts', async () => {
    const token = await registerAndGetToken();
    await request(app).get(`${CONFIRM_BASE}/${token}`);
    await request(app).get(`${CONFIRM_BASE}/${token}`); // second call → 409

    const restaurants = await Restaurant.find({ name: VALID_BODY.restaurantName });
    expect(restaurants).toHaveLength(1);
  });
});
