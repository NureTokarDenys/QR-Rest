const request = require('supertest');
const app = require('../src/app');
const { connectTestDB, clearDB, disconnectTestDB } = require('./setup/db');
const { createRestaurant, createStaff, authHeader } = require('./setup/helpers');
const User = require('../src/models/User');

beforeAll(() => connectTestDB());
afterEach(() => clearDB());
afterAll(() => disconnectTestDB());

describe('Admin staff management', () => {
  it('admin can create a staff member and receive temp password', async () => {
    const restaurant = await createRestaurant();
    const admin = await createStaff('admin', restaurant._id);

    const res = await request(app)
      .post(`/api/${restaurant._id}/admin/staff`)
      .set(authHeader(admin))
      .send({ email: 'waiter1@restaurant.com', name: 'Іван Офіціант', role: 'waiter' });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('tempPassword');
    expect(res.body.data.role).toBe('waiter');
  });

  it('temp password allows the staff member to log in', async () => {
    const restaurant = await createRestaurant();
    const admin = await createStaff('admin', restaurant._id);

    const createRes = await request(app)
      .post(`/api/${restaurant._id}/admin/staff`)
      .set(authHeader(admin))
      .send({ email: 'cook1@restaurant.com', name: 'Олег Кухар', role: 'cook' });

    const { tempPassword } = createRes.body.data;

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'cook1@restaurant.com',
      password: tempPassword,
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data).toHaveProperty('accessToken');
  });

  it('admin can change role of a staff member', async () => {
    const restaurant = await createRestaurant();
    const admin = await createStaff('admin', restaurant._id);
    const waiter = await createStaff('waiter', restaurant._id);

    const res = await request(app)
      .put(`/api/${restaurant._id}/admin/staff/${waiter._id}/role`)
      .set(authHeader(admin))
      .send({ role: 'cook' });

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('cook');
  });

  it('admin can deactivate and reactivate a staff member', async () => {
    const restaurant = await createRestaurant();
    const admin = await createStaff('admin', restaurant._id);
    const waiter = await createStaff('waiter', restaurant._id);

    const deactivateRes = await request(app)
      .post(`/api/${restaurant._id}/admin/staff/${waiter._id}/deactivate`)
      .set(authHeader(admin));
    expect(deactivateRes.status).toBe(200);
    expect(deactivateRes.body.data.isActive).toBe(false);

    const activateRes = await request(app)
      .post(`/api/${restaurant._id}/admin/staff/${waiter._id}/activate`)
      .set(authHeader(admin));
    expect(activateRes.status).toBe(200);
    expect(activateRes.body.data.isActive).toBe(true);
  });

  it('admin can reset staff password', async () => {
    const restaurant = await createRestaurant();
    const admin = await createStaff('admin', restaurant._id);
    const cook = await createStaff('cook', restaurant._id);

    const res = await request(app)
      .post(`/api/${restaurant._id}/admin/staff/${cook._id}/reset-password`)
      .set(authHeader(admin));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('sent', true);
  });

  it('returns 409 if email already exists', async () => {
    const restaurant = await createRestaurant();
    const admin = await createStaff('admin', restaurant._id);
    await createStaff('waiter', restaurant._id, { email: 'existing@restaurant.com' });

    const existingEmail = (await User.findOne({ restaurantId: restaurant._id, role: 'waiter' })).email;

    const res = await request(app)
      .post(`/api/${restaurant._id}/admin/staff`)
      .set(authHeader(admin))
      .send({ email: existingEmail, name: 'Duplicate', role: 'cook' });

    expect(res.status).toBe(409);
  });

  it('returns 401 for unauthenticated access', async () => {
    const restaurant = await createRestaurant();
    const res = await request(app).get(`/api/${restaurant._id}/admin/staff`);
    expect(res.status).toBe(401);
  });
});
