const User = require('../../src/models/User');
const Restaurant = require('../../src/models/Restaurant');
const Table = require('../../src/models/Table');
const Session = require('../../src/models/Session');
const { signAccess } = require('../../src/config/jwt');
const { v4: uuidv4 } = require('uuid');

/** Generate an 8-char uppercase alphanumeric public ID, matching the Restaurant._id format. */
function generateRestaurantId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

async function createRestaurant(overrides = {}) {
  return Restaurant.create({
    _id: generateRestaurantId(),
    name: 'Test Restaurant',
    slug: `test-restaurant-${Date.now()}`,
    address: 'Test Address',
    ...overrides,
  });
}

async function createUser(overrides = {}) {
  const restaurant = overrides.restaurantId
    ? { _id: overrides.restaurantId }
    : await createRestaurant();

  const passwordHash = await User.hashPassword(overrides.password || 'Password123!');
  return User.create({
    name: 'Test User',
    email: `test-${Date.now()}@example.com`,
    passwordHash,
    role: 'guest',
    restaurantId: restaurant._id,
    isActive: true,
    ...overrides,
    password: undefined,
  });
}

async function createStaff(role = 'waiter', restaurantId) {
  const passwordHash = await User.hashPassword('StaffPass123!');
  return User.create({
    name: `Test ${role}`,
    email: `${role}-${Date.now()}@example.com`,
    passwordHash,
    role,
    restaurantId,
    isActive: true,
  });
}

async function createTable(restaurantId, overrides = {}) {
  return Table.create({
    number: Math.floor(Math.random() * 100) + 1,
    restaurantId,
    status: 'free',
    ...overrides,
  });
}

async function createSession(tableId, restaurantId, overrides = {}) {
  return Session.create({
    token: uuidv4(),
    tableId,
    restaurantId,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    isActive: true,
    ...overrides,
  });
}

function authHeader(user) {
  const token = signAccess({ sub: user._id, role: user.role, restaurantId: user.restaurantId });
  return { Authorization: `Bearer ${token}` };
}

module.exports = { createRestaurant, createUser, createStaff, createTable, createSession, authHeader };
