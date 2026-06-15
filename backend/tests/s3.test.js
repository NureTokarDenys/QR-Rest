/**
 * AWS S3 image upload tests.
 *
 * uploadImage is mocked so no real AWS credentials are needed.
 * The mock simulates a successful S3 upload and returns a fake public URL.
 * To test against a real bucket: replace jest.mock below with actual credentials in .env.
 */

const request = require('supertest');
const { connectTestDB, clearDB, disconnectTestDB } = require('./setup/db');
const { createRestaurant, createStaff, authHeader } = require('./setup/helpers');
const Category = require('../src/models/Category');
const MenuItem = require('../src/models/MenuItem');

// Mock the AWS upload before the app module is loaded
jest.mock('../src/config/aws', () => ({
  uploadImage: jest.fn().mockResolvedValue('https://s3.amazonaws.com/test-bucket/test-image.jpg'),
  deleteImage: jest.fn().mockResolvedValue(undefined),
  MAX_FILE_SIZE: 5 * 1024 * 1024,
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  BUCKET: 'test-bucket',
}));

const app = require('../src/app');

beforeAll(() => connectTestDB());
afterEach(() => clearDB());
afterAll(() => disconnectTestDB());

// Minimal 1×1 px JPEG in binary for upload tests
const TINY_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U' +
  'HRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgN' +
  'DRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy' +
  'MjL/wAARCAABAAEDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAABgUE/8QAIhAAAgIB' +
  'BAMAAAAAAAAAAAAAAQIDBAUREiExQf/EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAA' +
  'AAAAAAAAAAAAAP/aAAwDAQACEQMRAD8Amk2ta1TlPqpqJyuSeT3JJJJJJJJJJJJJJJJJ' +
  'JJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJ' +
  'JJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJ',
  'base64'
);

describe('POST /api/:restaurantId/admin/menu/items/:itemId/image — S3 upload', () => {
  it('admin can upload a JPEG image and receives a public URL', async () => {
    const restaurant = await createRestaurant();
    const admin = await createStaff('admin', restaurant._id);
    const cat = await Category.create({ name: 'Тест', sortOrder: 1, restaurantId: restaurant._id });
    const item = await MenuItem.create({ name: 'Борщ', basePrice: 80, categoryId: cat._id, restaurantId: restaurant._id, isAvailable: true });

    const res = await request(app)
      .post(`/api/${restaurant._id}/admin/menu/items/${item._id}/image`)
      .set(authHeader(admin))
      .attach('image', TINY_JPEG, { filename: 'test.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('imageUrl');
    expect(res.body.data.imageUrl).toMatch(/^https?:\/\//);

    const updated = await MenuItem.findById(item._id);
    expect(updated.imageUrl).toBe(res.body.data.imageUrl);
  });

  it('returns 400 for an unsupported file type (e.g. GIF)', async () => {
    const restaurant = await createRestaurant();
    const admin = await createStaff('admin', restaurant._id);
    const cat = await Category.create({ name: 'Тест', sortOrder: 1, restaurantId: restaurant._id });
    const item = await MenuItem.create({ name: 'Борщ', basePrice: 80, categoryId: cat._id, restaurantId: restaurant._id, isAvailable: true });

    const gifBuffer = Buffer.from('GIF89a', 'ascii');

    const res = await request(app)
      .post(`/api/${restaurant._id}/admin/menu/items/${item._id}/image`)
      .set(authHeader(admin))
      .attach('image', gifBuffer, { filename: 'test.gif', contentType: 'image/gif' });

    expect(res.status).toBe(400);
  });

  it('returns 400 if no file is attached', async () => {
    const restaurant = await createRestaurant();
    const admin = await createStaff('admin', restaurant._id);
    const cat = await Category.create({ name: 'Тест', sortOrder: 1, restaurantId: restaurant._id });
    const item = await MenuItem.create({ name: 'Борщ', basePrice: 80, categoryId: cat._id, restaurantId: restaurant._id, isAvailable: true });

    const res = await request(app)
      .post(`/api/${restaurant._id}/admin/menu/items/${item._id}/image`)
      .set(authHeader(admin));

    expect(res.status).toBe(400);
  });

  it('returns 401 for unauthenticated request', async () => {
    const restaurant = await createRestaurant();
    const cat = await Category.create({ name: 'Тест', sortOrder: 1, restaurantId: restaurant._id });
    const item = await MenuItem.create({ name: 'Борщ', basePrice: 80, categoryId: cat._id, restaurantId: restaurant._id, isAvailable: true });

    const res = await request(app)
      .post(`/api/${restaurant._id}/admin/menu/items/${item._id}/image`)
      .attach('image', TINY_JPEG, { filename: 'test.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin staff', async () => {
    const restaurant = await createRestaurant();
    const waiter = await createStaff('waiter', restaurant._id);
    const cat = await Category.create({ name: 'Тест', sortOrder: 1, restaurantId: restaurant._id });
    const item = await MenuItem.create({ name: 'Борщ', basePrice: 80, categoryId: cat._id, restaurantId: restaurant._id, isAvailable: true });

    const res = await request(app)
      .post(`/api/${restaurant._id}/admin/menu/items/${item._id}/image`)
      .set(authHeader(waiter))
      .attach('image', TINY_JPEG, { filename: 'test.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(403);
  });

  it('rejects files larger than 5 MB', async () => {
    const restaurant = await createRestaurant();
    const admin = await createStaff('admin', restaurant._id);
    const cat = await Category.create({ name: 'Тест', sortOrder: 1, restaurantId: restaurant._id });
    const item = await MenuItem.create({ name: 'Борщ', basePrice: 80, categoryId: cat._id, restaurantId: restaurant._id, isAvailable: true });

    const bigBuffer = Buffer.alloc(6 * 1024 * 1024); // 6 MB

    const res = await request(app)
      .post(`/api/${restaurant._id}/admin/menu/items/${item._id}/image`)
      .set(authHeader(admin))
      .attach('image', bigBuffer, { filename: 'big.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(400);
  });
});
