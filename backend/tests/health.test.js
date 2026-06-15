const request = require('supertest');
const app = require('../src/app');
const { connectTestDB, disconnectTestDB } = require('./setup/db');

beforeAll(() => connectTestDB());
afterAll(() => disconnectTestDB());

describe('GET /api/health', () => {
  it('returns 200 with db status ok', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.data.db).toBe('ok');
    expect(res.body.data).toHaveProperty('uptime');
  });

  it('includes request_id in meta', async () => {
    const res = await request(app).get('/api/health');
    expect(res.body.meta).toHaveProperty('request_id');
    expect(res.headers['x-request-id']).toBeDefined();
  });
});
