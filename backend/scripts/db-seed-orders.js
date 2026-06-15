/**
 * db-seed-orders.js — reseed ONLY order-related data
 * Usage:  npm run db:seed-orders
 *
 * Leaves restaurants, staff, menu, categories, and reviews untouched.
 * Clears and rebuilds per restaurant:
 *   orders · orderitems · servinggroups · payments · waitercalls · sessions · auditlogs
 *
 * All timestamps are relative to the moment the script is run (NOW).
 *   • Historical orders span  NOW-29d … yesterday   (6-10 orders/day, same dist as db:seed)
 *   • Today's earlier orders  NOW-today              (8 completed)
 *   • Active orders           NOW-28m … NOW-12m      (4 orders, tables 2-5)
 *
 * NOTE: DishReview / RestaurantReview rows are left as-is (they become
 * orphaned but do not break the app).  Run db:seed for a full clean slate.
 */

'use strict';

require('dotenv').config();
const mongoose     = require('mongoose');
const crypto       = require('crypto');

// ── models ───────────────────────────────────────────────────────────────────
const Restaurant   = require('../src/models/Restaurant');
const User         = require('../src/models/User');
const Table        = require('../src/models/Table');
const Session      = require('../src/models/Session');
const MenuItem     = require('../src/models/MenuItem');
const Order        = require('../src/models/Order');
const OrderItem    = require('../src/models/OrderItem');
const ServingGroup = require('../src/models/ServingGroup');
const Payment      = require('../src/models/Payment');
const WaiterCall   = require('../src/models/WaiterCall');
const AuditLog     = require('../src/models/AuditLog');
const auditService = require('../src/services/auditService');

// ── time reference — everything is relative to the moment this script runs ───
const DAY_MS  = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MIN_MS  = 60 * 1000;

const NOW = new Date();

const todayMidnight = new Date(NOW);
todayMidnight.setHours(0, 0, 0, 0);

// 30-day window starts 29 days before today's midnight
const BASE_DATE = new Date(todayMidnight.getTime() - 29 * DAY_MS);

// ── active order parameters (identical to db-seed.js) ────────────────────────
const ACTIVE_OFFSETS_MIN   = [-28, -22, -16, -12];
const ACTIVE_STATUSES      = ['open', 'open', 'open', 'open'];
const ACTIVE_DISH_STATUSES = [
  ['cooking', 'waiting'],   // table 2 — first group cooking, second waiting
  ['waiting'],              // table 3 — single group waiting
  ['ready',   'ready'],     // table 4 — both groups ready
  ['cooking', 'waiting'],   // table 5 — first group cooking, second waiting
];
const ACTIVE_PATTERNS = [4, 1, 8, 6];

// ── menu item name → MENU_DEFS index map ─────────────────────────────────────
// Must stay in sync with MENU_DEFS order in db-seed.js so pattern indices align.
const MENU_ITEM_NAMES = [
  /* 0  */ 'Борщ з пампушками',
  /* 1  */ 'Юшка рибна',
  /* 2  */ 'Крем-суп грибний',
  /* 3  */ 'Суп-пюре з гарбуза',
  /* 4  */ 'Салат Цезар',
  /* 5  */ 'Грецький салат',
  /* 6  */ 'Вінегрет',
  /* 7  */ 'Салат Нісуаз',
  /* 8  */ 'Шопський салат',
  /* 9  */ 'Крила курячі',
  /* 10 */ 'Кальмар у клярі',
  /* 11 */ 'Жульєн',
  /* 12 */ 'Сирні кульки',
  /* 13 */ 'Рибай стейк',
  /* 14 */ 'Свиняча відбивна',
  /* 15 */ 'Котлета по-київськи',
  /* 16 */ 'Шашлик зі свинини',
  /* 17 */ 'Качина конфі',
  /* 18 */ 'Телятина відбивна',
  /* 19 */ 'Лосось на грилі',
  /* 20 */ 'Дорадо запечена',
  /* 21 */ 'Тигрові креветки',
  /* 22 */ 'Мідії у соусі',
  /* 23 */ 'Лимонад',
  /* 24 */ 'Свіжий сік',
  /* 25 */ 'Чай',
  /* 26 */ 'Кава',
  /* 27 */ 'Компот',
  /* 28 */ 'Медовик',
  /* 29 */ 'Тірамісу',
  /* 30 */ 'Панакота',
  /* 31 */ 'Шоколадний фондан',
];

// ── order patterns — premium restaurant (all 32 items, indices 0-31) ─────────
const ORDER_PATTERNS = [
  [['Основна подача',   [[0,1], [23,2]]]],
  [['Основна подача',   [[4,1], [15,1], [26,1]]]],
  [['Основна подача',   [[0,1], [16,1], [27,2]]]],
  [['Основна подача',   [[5,1], [22,1], [25,2]]]],
  [['Перша подача',     [[0,1], [6,1]]],
   ['Основна страва',   [[13,1], [23,1], [28,1]]]],
  [['Перша подача',     [[2,1], [7,1]]],
   ['Основна страва',   [[15,1], [25,2], [29,1]]]],
  [['Перша подача',     [[1,1], [5,1]]],
   ['Основна страва',   [[19,1], [25,1], [30,1]]]],
  [['Закуска',          [[3,1]]],
   ['Основна страва',   [[17,1], [23,1]]],
   ['Десерт',           [[31,1], [26,1]]]],
  [['Закуска',          [[4,1], [9,1]]],
   ['Основна страва',   [[20,1], [26,1]]],
   ['Десерт',           [[29,1]]]],
  [['Закуска',          [[11,1], [12,1]]],
   ['Основна страва',   [[16,1], [24,1]]],
   ['Десерт',           [[28,1], [30,1]]]],
];

// ── order patterns — free restaurant (items 0-22 only) ───────────────────────
const FREE_ORDER_PATTERNS = [
  [['Основна подача',   [[0,1], [4,1]]]],
  [['Основна подача',   [[4,1], [15,1]]]],
  [['Основна подача',   [[0,1], [16,1]]]],
  [['Основна подача',   [[5,1], [22,1]]]],
  [['Перша подача',     [[0,1], [6,1]]],
   ['Основна страва',   [[13,1], [9,1]]]],
  [['Перша подача',     [[2,1], [7,1]]],
   ['Основна страва',   [[15,1], [10,1]]]],
  [['Перша подача',     [[1,1], [5,1]]],
   ['Основна страва',   [[19,1], [12,1]]]],
  [['Закуска',          [[3,1]]],
   ['Основна страва',   [[17,1], [21,1]]],
   ['Третя страва',     [[11,1]]]],
  [['Закуска',          [[4,1], [9,1]]],
   ['Основна страва',   [[20,1]]]],
  [['Закуска',          [[11,1], [12,1]]],
   ['Основна страва',   [[16,1], [14,1]]]],
];

// ── helpers ───────────────────────────────────────────────────────────────────
function log(label, n) {
  console.log(`  ✓  ${label.padEnd(30)}${n}`);
}

function fmtDate(d) {
  return d.toLocaleDateString('uk-UA', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTime(d) {
  return d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
}

function getGroupStatusChangedAt(dishStatus, orderDate, i, sgIdx) {
  if (dishStatus === 'waiting') return null;
  if (dishStatus === 'cooking') return new Date(orderDate.getTime() +  4 * MIN_MS);
  if (dishStatus === 'ready')   return new Date(orderDate.getTime() + 10 * MIN_MS);
  if (dishStatus === 'served') {
    const offset = 25 + sgIdx * 8 + (i % 10);
    return new Date(orderDate.getTime() + offset * MIN_MS);
  }
  return null;
}

function buildItemPayload(entry, qty, dishStatus, seed) {
  const { item } = entry;

  const removable = (item.ingredients || []).filter(ing => ing.isRemovable);
  const numExcl   = seed % 4 === 1 ? Math.min(1, removable.length)
                  : seed % 4 === 2 ? Math.min(2, removable.length)
                  : 0;
  const excludedIngredients = removable.slice(0, numExcl).map(ing => ({ _id: ing._id, name: ing.name }));

  const componentGroupChoices = [];
  const availableGroups = (item.componentGroups || []).filter(g => g.isAvailable !== false && (g.options || []).length > 0);
  for (const g of availableGroups) {
    const optIdx = seed % 6 === 5 ? 0 : seed % g.options.length;
    const opt    = g.options[optIdx];
    componentGroupChoices.push({
      groupId:       g._id,
      groupName:     g.name,
      optionId:      opt._id,
      optionName:    opt.name,
      priceModifier: opt.priceModifier || 0,
    });
  }

  const addons         = [];
  const availableAddons = (item.addons || []).filter(a => a.isAvailable !== false);
  if (availableAddons.length > 0 && seed % 4 === 0)
    addons.push({ _id: availableAddons[0]._id, name: availableAddons[0].name, price: availableAddons[0].price, quantity: 1 });
  if (availableAddons.length > 1 && seed % 9 === 3)
    addons.push({ _id: availableAddons[1]._id, name: availableAddons[1].name, price: availableAddons[1].price, quantity: 1 });

  return { menuItemId: item._id, menuItemName: item.name, quantity: qty, unitPrice: item.basePrice, dishStatus, excludedIngredients, componentGroupChoices, addons };
}

// Deterministic public-ID generator — same algorithm as db-seed.js.
// Produces identical IDs for the same (restPrefix, index) pair.
function seedOrderId(restPrefix, i) {
  const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const hash  = crypto.createHash('sha256').update(`qr-seed-order-${restPrefix}-${i}`).digest();
  return Array.from({ length: 8 }, (_, k) => ALPHA[hash[k] % ALPHA.length]).join('');
}

function calcTotal(orderItems) {
  return orderItems.reduce((sum, oi) => {
    const compMod = (oi.componentGroupChoices || []).reduce((s, c) => s + (c.priceModifier || 0), 0);
    const aoTotal = (oi.addons || []).reduce((s, a) => s + (a.price || 0) * (a.quantity || 1), 0);
    return sum + (oi.unitPrice + compMod) * oi.quantity + aoTotal;
  }, 0);
}

// ── build catalog from DB ─────────────────────────────────────────────────────
// Returns a sparse array indexed by MENU_ITEM_NAMES position.
// Slots for items not in this restaurant's menu are null (skipped during seeding).
async function buildCatalog(rId) {
  const items  = await MenuItem.find({ restaurantId: rId }).lean();
  const byName = new Map(items.map(it => [it.name, it]));
  return MENU_ITEM_NAMES.map(name => {
    const item = byName.get(name);
    return item ? { item } : null;
  });
}

// ── per-restaurant order seeding ─────────────────────────────────────────────
async function seedOrdersForRestaurant({
  rId, restPrefix, catalog,
  guests, allTables, activeTables, activeSessions, staffWaiters,
  orderPatterns,
}) {
  let ordersCreated = 0, paymentsCreated = 0, auditLogsCreated = 0;
  let cashCallOrder = null, waiterCallOrder = null, questionOrder = null;

  // Build the 30-day seeding plan — same shape as db-seed.js
  const plan = [];
  for (let dayBack = 29; dayBack >= 1; dayBack--) {
    const count = 6 + ((dayBack * 3) % 5);   // deterministic 6-10 orders/day
    for (let n = 0; n < count; n++) {
      plan.push({ dayBack, slot: n, isActive: false, activeIdx: -1 });
    }
  }
  // Today — completed earlier in the day
  for (let n = 0; n < 8; n++) {
    plan.push({ dayBack: 0, slot: n, isActive: false, activeIdx: -1 });
  }
  // Today — active right now (tables 2-5)
  for (let n = 0; n < 4; n++) {
    plan.push({ dayBack: 0, slot: 100 + n, isActive: true, activeIdx: n });
  }

  for (let i = 0; i < plan.length; i++) {
    const { isActive, activeIdx } = plan[i];
    const guest = guests[i % guests.length];

    let tableObj, sessionToken, orderStatus, orderDate;

    if (isActive) {
      tableObj     = activeTables[activeIdx];
      sessionToken = activeSessions[activeIdx].token;
      orderStatus  = ACTIVE_STATUSES[activeIdx];
      orderDate    = new Date(NOW.getTime() + ACTIVE_OFFSETS_MIN[activeIdx] * MIN_MS);
    } else {
      tableObj = allTables[i % allTables.length];
      const { dayBack, slot } = plan[i];
      const dayStart = new Date(todayMidnight.getTime() - dayBack * DAY_MS);
      const h = 11 + ((i * 3 + slot * 2) % 10);   // 11:00 – 20:59
      const m = (i * 17 + slot * 11) % 60;
      orderDate = new Date(dayStart.getTime() + h * HOUR_MS + m * MIN_MS);

      const sess = await Session.create({
        tableId:   tableObj._id,
        restaurantId: rId,
        isActive:  false,
        expiresAt: new Date(orderDate.getTime() + 3 * HOUR_MS),
        createdAt: orderDate,
      });
      sessionToken = sess.token;

      orderStatus = (i % 47 === 7 || i % 53 === 13) ? 'cancelled'
                  : i % 3 === 0                      ? 'completed_cash'
                  :                                    'completed_epay';
    }

    const orderPayload = {
      _id:          seedOrderId(restPrefix, i),
      tableId:      tableObj._id,
      restaurantId: rId,
      sessionToken,
      status:       orderStatus,
      userId:       guest._id,
      createdAt:    orderDate,
      updatedAt:    orderDate,
    };
    if (orderStatus === 'cancelled') orderPayload.cancelReason = 'Гість скасував замовлення';

    const order = await Order.create(orderPayload);
    ordersCreated++;

    const patternIdx = isActive ? ACTIVE_PATTERNS[activeIdx] : i % orderPatterns.length;
    const pattern    = orderPatterns[patternIdx];
    const allItems   = [];

    for (let sgIdx = 0; sgIdx < pattern.length; sgIdx++) {
      const [sgName, dishPairs] = pattern[sgIdx];

      let groupDishStatus;
      if (['completed_cash', 'completed_epay'].includes(orderStatus)) {
        groupDishStatus = 'served';
      } else if (orderStatus === 'cancelled') {
        groupDishStatus = 'waiting';
      } else {
        // active order — per-group status from ACTIVE_DISH_STATUSES
        const statuses  = ACTIVE_DISH_STATUSES[activeIdx] || ['waiting'];
        groupDishStatus = statuses[sgIdx] ?? statuses[statuses.length - 1];
      }

      const statusChangedAt = getGroupStatusChangedAt(groupDishStatus, orderDate, i, sgIdx);
      const sg = await ServingGroup.create({
        orderId:   order._id,
        name:      sgName,
        sortOrder: sgIdx,
        statusChangedAt,
        createdAt:  orderDate,
        updatedAt:  statusChangedAt || orderDate,
      });

      for (let dIdx = 0; dIdx < dishPairs.length; dIdx++) {
        const [dishIdx, qty] = dishPairs[dIdx];
        if (!catalog[dishIdx]) continue;   // item absent from this restaurant's menu
        const seed    = i * 100 + sgIdx * 10 + dIdx;
        const payload = buildItemPayload(catalog[dishIdx], qty, groupDishStatus, seed);
        const oi      = await OrderItem.create({ orderId: order._id, servingGroupId: sg._id, ...payload });
        allItems.push(oi);
      }
    }

    if (['completed_cash', 'completed_epay'].includes(orderStatus)) {
      const amount = calcTotal(allItems);
      const method = orderStatus === 'completed_cash' ? 'cash' : 'online';
      const payDoc = { orderId: order._id, restaurantId: rId, amount, method, status: 'completed' };
      let waiter, transactionId;
      if (method === 'cash') {
        waiter = staffWaiters[i % Math.max(1, staffWaiters.length)];
        if (waiter) payDoc.processedBy = waiter._id;
      } else {
        transactionId = `liqpay-seed-${restPrefix}-${String(i).padStart(3, '0')}`;
        payDoc.liqpayTransactionId = transactionId;
      }
      await Payment.create(payDoc);
      paymentsCreated++;

      await AuditLog.create({
        restaurantId:  rId,
        eventType:     method === 'cash' ? 'CASH_PAYMENT' : 'EPAY_PAYMENT',
        orderId:       order._id,
        tableId:       tableObj._id,
        initiatedBy:   method === 'cash' && waiter ? { userId: waiter._id, role: waiter.role } : undefined,
        amount,
        paymentMethod: method === 'cash' ? 'CASH' : 'ONLINE',
        transactionId,
        receipt:       auditService.buildReceipt(allItems, { paidAt: orderDate }),
        timestamp:     orderDate,
        meta:          { sessionToken },
      });
      auditLogsCreated++;
    } else if (orderStatus === 'cancelled') {
      await AuditLog.create({
        restaurantId: rId,
        eventType:    'CANCEL',
        orderId:      order._id,
        tableId:      tableObj._id,
        reason:       order.cancelReason,
        timestamp:    orderDate,
        meta:         { sessionToken },
      });
      auditLogsCreated++;
    }

    // Track which active orders will get waiter calls
    if (isActive && activeIdx === 0) cashCallOrder   = { order, session: activeSessions[0], table: activeTables[0] };
    if (isActive && activeIdx === 2) waiterCallOrder = { order, session: activeSessions[2], table: activeTables[2] };
    if (isActive && activeIdx === 3) questionOrder   = { order, session: activeSessions[3], table: activeTables[3] };
  }

  // Waiter calls — same assignment as db-seed.js:
  //   table 2 (activeIdx 0) → cash_payment call
  //   table 4 (activeIdx 2) → call
  //   table 5 (activeIdx 3) → call
  let waiterCallsCreated = 0;
  const callDefs = [
    { ref: cashCallOrder,   type: 'cash_payment' },
    { ref: waiterCallOrder, type: 'call'         },
    { ref: questionOrder,   type: 'call'         },
  ];
  for (const { ref, type } of callDefs) {
    if (!ref) continue;
    await WaiterCall.create({
      tableId:      ref.table._id,
      restaurantId: rId,
      orderId:      ref.order._id,
      sessionToken: ref.session.token,
      type,
      status: 'active',
    });
    waiterCallsCreated++;
  }

  return { ordersCreated, paymentsCreated, waiterCallsCreated, auditLogsCreated };
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set in .env');

  console.log('Connecting to MongoDB…');
  await mongoose.connect(uri);

  console.log(`\nTime reference : ${fmtDate(NOW)}  ${fmtTime(NOW)}`);
  console.log(`Historical span: ${fmtDate(BASE_DATE)} → ${fmtDate(new Date(todayMidnight.getTime() - DAY_MS))}  (29 days)`);
  console.log(`Today          : 8 completed + 4 active  (active: ${fmtTime(new Date(NOW.getTime() + ACTIVE_OFFSETS_MIN[0] * MIN_MS))} – ${fmtTime(new Date(NOW.getTime() + ACTIVE_OFFSETS_MIN[3] * MIN_MS))})\n`);

  const restaurants = await Restaurant.find({}).lean();
  if (!restaurants.length) {
    throw new Error('No restaurants in DB — run npm run db:seed first to create the base data');
  }

  const guests = await User.find({ role: 'guest' }).lean();
  if (!guests.length) {
    throw new Error('No guest users in DB — run npm run db:seed first');
  }

  const db = mongoose.connection.db;

  for (const restaurant of restaurants) {
    const rId        = restaurant._id;
    const planLabel  = restaurant.plan.toUpperCase();
    const restPrefix = String(restaurant._id);

    console.log('─'.repeat(55));
    console.log(`${restaurant.name}  [${planLabel}]\n`);

    // ── Clear order-related collections for this restaurant ───────────────────
    const ORDER_COLLECTIONS = ['orders', 'orderitems', 'servinggroups', 'payments', 'waitercalls', 'sessions', 'auditlogs'];
    for (const col of ORDER_COLLECTIONS) {
      try { await db.collection(col).deleteMany({ restaurantId: rId }); } catch {}
    }

    // ── Tables: fetch sorted, reset statuses ──────────────────────────────────
    const tables = await Table.find({ restaurantId: rId }).sort({ number: 1 }).lean();
    if (tables.length < 5) {
      throw new Error(`${restaurant.name}: expected ≥ 5 tables, found ${tables.length}`);
    }

    // Table 1 → free, tables 2-5 → occupied (4 active orders)
    await Table.updateOne({ _id: tables[0]._id }, { $set: { status: 'free'     } });
    for (const t of tables.slice(1)) {
      await Table.updateOne({ _id: t._id }, { $set: { status: 'occupied' } });
    }

    const activeTables = tables.slice(1);   // indices 1-4 → tables 2-5

    // ── Fresh active sessions for the 4 occupied tables ───────────────────────
    const activeSessions = await Promise.all(
      activeTables.map(t => Session.create({ tableId: t._id, restaurantId: rId }))
    );

    // ── Rebuild catalog from DB menu items ────────────────────────────────────
    const catalog    = await buildCatalog(rId);
    const catalogLen = catalog.filter(Boolean).length;

    // ── Staff for processedBy on cash payments ────────────────────────────────
    const staff        = await User.find({ restaurantId: rId }).lean();
    const staffWaiters = staff.filter(s => s.role === 'waiter' || s.role === 'waiter_cook');

    // ── Seed orders ───────────────────────────────────────────────────────────
    const orderPatterns = restaurant.plan === 'free' ? FREE_ORDER_PATTERNS : ORDER_PATTERNS;

    const counts = await seedOrdersForRestaurant({
      rId,
      restPrefix,
      catalog,
      guests,
      allTables:    tables,
      activeTables,
      activeSessions,
      staffWaiters,
      orderPatterns,
    });

    log('menu items in catalog',    catalogLen);
    log('active sessions',          4);
    log('orders (30 days)',          counts.ordersCreated);
    log('payments',                  counts.paymentsCreated);
    log('audit logs (receipts)',     counts.auditLogsCreated);
    log('waiter calls',              counts.waiterCallsCreated);
    console.log();
  }

  console.log('═'.repeat(55));
  console.log('✅  Order reseed complete!\n');
  console.log(`Window : ${fmtDate(BASE_DATE)} – ${fmtDate(todayMidnight)}  (30 days including today)`);
  console.log(`Active : –28 m → –12 m  (tables 2–5 per restaurant)`);

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('\n❌  Seed failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
