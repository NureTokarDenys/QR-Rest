const request = require('supertest');
const app = require('../src/app');
const { connectTestDB, clearDB, disconnectTestDB } = require('./setup/db');
const { createUser } = require('./setup/helpers');

beforeAll(() => connectTestDB());
afterEach(() => clearDB());
afterAll(() => disconnectTestDB());

describe('POST /api/auth/register', () => {
  it('registers a new guest user and returns tokens', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'newuser@example.com',
      password: 'Password123!',
      name: 'New User',
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');
    expect(res.body.data.user.email).toBe('newuser@example.com');
    expect(res.body.data.user.role).toBe('guest');
  });

  it('returns 409 if email already exists', async () => {
    await createUser({ email: 'dup@example.com' });

    const res = await request(app).post('/api/auth/register').send({
      email: 'dup@example.com',
      password: 'Password123!',
      name: 'Dup User',
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('returns 400 if required fields are missing', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'x@x.com' });
    expect(res.status).toBe(400);
  });

  it('returns 400 if password is too short', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'short@example.com',
      password: '123',
      name: 'Short',
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('returns tokens on valid credentials', async () => {
    await createUser({ email: 'login@example.com', password: 'Password123!' });

    const res = await request(app).post('/api/auth/login').send({
      email: 'login@example.com',
      password: 'Password123!',
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('accessToken');
  });

  it('returns 401 on wrong password', async () => {
    await createUser({ email: 'wrongpass@example.com', password: 'Password123!' });

    const res = await request(app).post('/api/auth/login').send({
      email: 'wrongpass@example.com',
      password: 'WrongPassword!',
    });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns 401 for non-existent email', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@example.com',
      password: 'Password123!',
    });
    expect(res.status).toBe(401);
  });

  it('locks account after 5 failed attempts', async () => {
    await createUser({ email: 'lockme@example.com', password: 'Password123!' });

    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/auth/login').send({ email: 'lockme@example.com', password: 'Wrong!' });
    }

    const res = await request(app).post('/api/auth/login').send({
      email: 'lockme@example.com',
      password: 'Password123!',
    });
    expect(res.status).toBe(423);
    expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
  });
});

describe('POST /api/auth/refresh', () => {
  it('returns a new access token for valid refresh token', async () => {
    const regRes = await request(app).post('/api/auth/register').send({
      email: 'refresh@example.com',
      password: 'Password123!',
      name: 'Refresh User',
    });
    const { refreshToken } = regRes.body.data;

    const res = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('accessToken');
  });

  it('returns 401 for invalid refresh token', async () => {
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: 'invalid.token.here' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('logs out and blacklists the token', async () => {
    const regRes = await request(app).post('/api/auth/register').send({
      email: 'logout@example.com',
      password: 'Password123!',
      name: 'Logout User',
    });
    const { accessToken } = regRes.body.data;

    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(logoutRes.status).toBe(200);

    // Blacklisted token should now return 401
    const profileRes = await request(app)
      .get('/api/user/profile')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(profileRes.status).toBe(401);
  });
});
