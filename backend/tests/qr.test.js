const request = require('supertest');
const app = require('../src/app');
const { connectTestDB, clearDB, disconnectTestDB } = require('./setup/db');
const { createRestaurant, createTable, createSession } = require('./setup/helpers');
const Session = require('../src/models/Session');

beforeAll(() => connectTestDB());
afterEach(() => clearDB());
afterAll(() => disconnectTestDB());

describe('GET /api/qr/:shortCode', () => {
  it('creates a new session for a free table', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);

    const res = await request(app).get(`/api/qr/${table.shortCode}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('sessionToken');
    expect(res.body.data.tableId).toBe(table._id.toString());
    expect(res.body.data.isNew).toBe(true);

    const session = await Session.findOne({ token: res.body.data.sessionToken });
    expect(session).not.toBeNull();
    expect(session.isActive).toBe(true);
  });

  it('recovers existing active session (isNew=false)', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const session = await createSession(table._id, restaurant._id);

    const res = await request(app)
      .get(`/api/qr/${table.shortCode}`)
      .set('Cookie', `session_token=${session.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.isNew).toBe(false);

    // Only one session should exist
    const count = await Session.countDocuments({ tableId: table._id, isActive: true });
    expect(count).toBe(1);
  });

  it('returns 404 for unknown short-code', async () => {
    const res = await request(app).get('/api/qr/INVALID99');
    expect(res.status).toBe(404);
  });

  it('returns available:false for disabled table', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id, { status: 'disabled' });

    const res = await request(app).get(`/api/qr/${table.shortCode}`);

    expect(res.status).toBe(200);
    expect(res.body.data.available).toBe(false);
  });

  it('sets session_token cookie on success', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);

    const res = await request(app).get(`/api/qr/${table.shortCode}`);

    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie'][0]).toMatch(/session_token=/);
  });
});
