const request = require('supertest');
const app = require('../src/app');
const { connectTestDB, clearDB, disconnectTestDB } = require('./setup/db');
const { createRestaurant, createTable, createStaff, authHeader } = require('./setup/helpers');
const Category = require('../src/models/Category');
const MenuItem = require('../src/models/MenuItem');

beforeAll(() => connectTestDB());
afterEach(() => clearDB());
afterAll(() => disconnectTestDB());

async function seedMenu(restaurantId) {
  const cat = await Category.create({ name: 'Салати', sortOrder: 1, restaurantId });
  const item = await MenuItem.create({
    name: 'Цезар',
    description: 'Класичний салат',
    basePrice: 150,
    categoryId: cat._id,
    restaurantId,
    isAvailable: true,
  });
  return { cat, item };
}

describe('GET /api/:restaurantId/menu (public)', () => {
  it('returns full menu grouped by categories', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    await seedMenu(restaurant._id);

    const res = await request(app).get(`/api/${restaurant._id}/menu?tableId=${table._id}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0]).toHaveProperty('items');
    expect(res.body.data[0].items[0].name).toBe('Цезар');
  });

  it('returns 200 with empty data when no menu exists (tableId no longer required in scoped route)', async () => {
    const restaurant = await createRestaurant();
    const res = await request(app).get(`/api/${restaurant._id}/menu`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('excludes unavailable items', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    const { cat } = await seedMenu(restaurant._id);
    await MenuItem.create({ name: 'Стоп-страва', basePrice: 100, categoryId: cat._id, restaurantId: restaurant._id, isAvailable: false });

    const res = await request(app).get(`/api/${restaurant._id}/menu?tableId=${table._id}`);
    const allItems = res.body.data.flatMap((c) => c.items);
    expect(allItems.find((i) => i.name === 'Стоп-страва')).toBeUndefined();
  });
});

describe('GET /api/:restaurantId/menu/items/:itemId (public)', () => {
  it('returns dish details with ingredients placeholder', async () => {
    const restaurant = await createRestaurant();
    await seedMenu(restaurant._id);
    const item = await MenuItem.findOne({ restaurantId: restaurant._id });

    const res = await request(app).get(`/api/${restaurant._id}/menu/items/${item._id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Цезар');
    expect(res.body.data).toHaveProperty('ingredients');
    expect(res.body.data).toHaveProperty('addons');
    expect(res.body.data).toHaveProperty('componentGroups');
  });

  it('returns 404 for unknown item', async () => {
    const restaurant = await createRestaurant();
    const res = await request(app).get(`/api/${restaurant._id}/menu/items/000000000000000000000000`);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/:restaurantId/menu/search (public)', () => {
  it('returns items matching query string', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    await seedMenu(restaurant._id);

    const res = await request(app).get(`/api/${restaurant._id}/menu/search`).query({ q: 'цез', tableId: table._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].name).toMatch(/Цезар/i);
  });

  it('returns empty array for non-matching query', async () => {
    const restaurant = await createRestaurant();
    const table = await createTable(restaurant._id);
    await seedMenu(restaurant._id);

    const res = await request(app).get(`/api/${restaurant._id}/menu/search`).query({ q: 'бургер123xyz', tableId: table._id.toString() });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(0);
  });
});

describe('Admin menu CRUD', () => {
  it('admin can create a category', async () => {
    const restaurant = await createRestaurant();
    const admin = await createStaff('admin', restaurant._id);

    const res = await request(app)
      .post(`/api/${restaurant._id}/admin/menu/categories`)
      .set(authHeader(admin))
      .send({ name: 'Напої', sortOrder: 2 });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Напої');
  });

  it('returns 403 for non-admin creating category', async () => {
    const restaurant = await createRestaurant();
    const waiter = await createStaff('waiter', restaurant._id);

    const res = await request(app)
      .post(`/api/${restaurant._id}/admin/menu/categories`)
      .set(authHeader(waiter))
      .send({ name: 'Напої', sortOrder: 2 });

    expect(res.status).toBe(403);
  });

  it('admin can create and soft-delete a menu item', async () => {
    const restaurant = await createRestaurant();
    const admin = await createStaff('admin', restaurant._id);
    const cat = await Category.create({ name: 'Основні', sortOrder: 1, restaurantId: restaurant._id });

    const createRes = await request(app)
      .post(`/api/${restaurant._id}/admin/menu/items`)
      .set(authHeader(admin))
      .send({ name: 'Борщ', price: 120, categoryId: cat._id });

    expect(createRes.status).toBe(201);
    const itemId = createRes.body.data._id;

    const deleteRes = await request(app)
      .delete(`/api/${restaurant._id}/admin/menu/items/${itemId}`)
      .set(authHeader(admin));

    expect(deleteRes.status).toBe(204);

    const deleted = await MenuItem.findById(itemId);
    expect(deleted.isDeleted).toBe(true);
  });
});
