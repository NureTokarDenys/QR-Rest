/**
 * Database seed script — v6
 * Usage:  npm run db:seed
 *
 * All timestamps are relative to the moment the script is run (NOW).
 *   • Historical orders span  NOW-7d … NOW-1d  (yesterday)
 *   • Active orders arrive    NOW-28m … NOW-12m
 *
 * Creates:
 *   • 2  restaurants:
 *       – BR5CH3OK  (free plan)    — 3 staff (@borshchechok.ua)
 *       – PR3MIUM1  (premium plan) — 5 staff (@premium.ua)
 *   • 35 guests  (shared pool, email: guest1@example.com … guest35@example.com)
 *   • Per restaurant:
 *       – 5  tables
 *       – 7  categories  (uk + en translations)
 *       – 32 menu items  (uk + en translations)
 *       – 50 orders  (4 active, 2 cancelled, 44 completed)
 *           – 1-3 serving groups per order with statusChangedAt
 *           – per-group dish statuses (realistic for multi-group active orders)
 *           – payments for completed orders
 *       – 3  waiter calls: table 2 (cash_payment), table 4 (call), table 5 (call)
 *   • Reviews  — ONLY for premium restaurant
 */

'use strict';

require('dotenv').config();
const mongoose       = require('mongoose');
const bcrypt         = require('bcrypt');
const crypto         = require('crypto');

// ── models ───────────────────────────────────────────────────────────────────
const Restaurant      = require('../src/models/Restaurant');
const User            = require('../src/models/User');
const Table           = require('../src/models/Table');
const Session         = require('../src/models/Session');
const Category        = require('../src/models/Category');
const MenuItem        = require('../src/models/MenuItem');
const Ingredient      = require('../src/models/Ingredient');
const AddOn           = require('../src/models/AddOn');
const ComponentGroup  = require('../src/models/ComponentGroup');
const ComponentOption = require('../src/models/ComponentOption');
const Order           = require('../src/models/Order');
const OrderItem       = require('../src/models/OrderItem');
const ServingGroup    = require('../src/models/ServingGroup');
const Payment         = require('../src/models/Payment');
const AuditLog        = require('../src/models/AuditLog');
const WaiterCall      = require('../src/models/WaiterCall');
const DishReview      = require('../src/models/DishReview');
const RestaurantReview = require('../src/models/RestaurantReview');
const auditService     = require('../src/services/auditService');

const { setTranslationEntry } = require('../src/utils/translatedField');

// ── time constants ────────────────────────────────────────────────────────────
const STAFF_PASSWORD = '12345678';
const SALT_ROUNDS    = 10;
const DAY_MS         = 24 * 60 * 60 * 1000;
const HOUR_MS        = 60 * 60 * 1000;
const MIN_MS         = 60 * 1000;

const NOW = new Date();

const todayMidnight = new Date(NOW);
todayMidnight.setHours(0, 0, 0, 0);
const BASE_DATE = new Date(todayMidnight.getTime() - 29 * DAY_MS);

const ACTIVE_OFFSETS_MIN = [-28, -22, -16, -12];

// ── CDN image helpers ─────────────────────────────────────────────────────────
const CDN     = 'https://qr-rest-bucket.s3.eu-central-1.amazonaws.com/';
const img     = (name) => CDN + name;
const GENERIC = img('generic.jpg');

// ── i18n helpers ──────────────────────────────────────────────────────────────
const NAME_EN = {
  'Супи':                         'Soups',
  'Салати':                       'Salads',
  'Гарячі закуски':               'Hot Appetizers',
  "М'ясні страви":                'Meat Dishes',
  'Риба та морепродукти':         'Fish & Seafood',
  'Напої':                        'Drinks',
  'Десерти':                      'Desserts',
  "М'ясо у борщ":                 'Meat for Borscht',
  'Вид риби':                     'Type of Fish',
  'Топінг':                       'Topping',
  'Подача':                       'Serving Style',
  'Протеїн':                      'Protein',
  'Заправка':                     'Dressing',
  'Вид тунця':                    'Type of Tuna',
  'Вид сиру':                     'Type of Cheese',
  'Соус':                         'Sauce',
  'Соус для подачі':              'Dipping Sauce',
  'Начинка':                      'Filling',
  'Ступінь прожарки':             'Doneness',
  'Гарнір':                       'Side Dish',
  'Вид кави':                     'Type of Coffee',
  'Вид чаю':                      'Type of Tea',
  'Вид соку':                     'Type of Juice',
  'Смак':                         'Flavor',
  'Температура':                  'Temperature',
  'Порція':                       'Portion',
  'Спосіб подачі':                'Serving Method',
  "Без м'яса":                    'No Meat',
  'Яловичина':                    'Beef',
  'Свинячі реберця':              'Pork Ribs',
  'Короп':                        'Carp',
  'Судак':                        'Pike Perch',
  'Форель':                       'Trout',
  'Грінки':                       'Croutons',
  'Трюфельна олія':               'Truffle Oil',
  'З насінням гарбуза':           'With Pumpkin Seeds',
  'З беконом':                    'With Bacon',
  'З вершками':                   'With Cream',
  'Куряча грудка':                'Chicken Breast',
  'Бекон':                        'Bacon',
  'Лосось':                       'Salmon',
  'Оливкова олія':                'Olive Oil',
  'Лимонна заправка':             'Lemon Dressing',
  'Йогуртова':                    'Yogurt',
  'Соняшникова олія':             'Sunflower Oil',
  'Консервований тунець':         'Canned Tuna',
  'Свіжий тунець':                'Fresh Tuna',
  'Бринза':                       'Brynza',
  'Фета':                         'Feta',
  'Сулугуні':                     'Sulguni',
  'BBQ':                          'BBQ',
  'Гостро-солодкий':              'Sweet & Spicy',
  "Медово-гірчичний":             'Honey Mustard',
  'Часниковий':                   'Garlic',
  'Тартар':                       'Tartar',
  'Часниковий айолі':             'Garlic Aioli',
  'Гострий чилі':                 'Spicy Chili',
  "Курка та гриби":               'Chicken & Mushrooms',
  'Морепродукти':                 'Seafood',
  'Тільки гриби':                 'Mushrooms Only',
  'Журавлинний':                  'Cranberry',
  'Томатний':                     'Tomato',
  'Картопляне пюре':              'Mashed Potatoes',
  'Рис':                          'Rice',
  'Картопля фрі':                 'French Fries',
  'Овочі гриль':                  'Grilled Vegetables',
  'Рис з овочами':                'Rice with Vegetables',
  'Тушкована капуста':            'Braised Cabbage',
  'Гриль':                        'Grilled',
  'У часниковому соусі':          'In Garlic Sauce',
  'У вершково-часниковому соусі': 'In Cream Garlic Sauce',
  'Вершково-часниковий':          'Creamy Garlic',
  'Біле вино та зелень':          'White Wine & Herbs',
  'Класичний':                    'Classic',
  'Полуниця':                     'Strawberry',
  'Маракуя':                      'Passion Fruit',
  "М'ята та огірок":              'Mint & Cucumber',
  'Апельсиновий':                 'Orange',
  'Яблучний':                     'Apple',
  'Морквяний':                    'Carrot',
  'Гранатовий':                   'Pomegranate',
  'Чорний':                       'Black',
  'Зелений':                      'Green',
  "Трав'яний":                    'Herbal',
  'Фруктовий':                    'Fruit',
  'Еспресо':                      'Espresso',
  'Американо':                    'Americano',
  'Капучино':                     'Cappuccino',
  'Латте':                        'Latte',
  'Холодний':                     'Cold',
  'Теплий':                       'Warm',
  'Стандартна':                   'Standard',
  'Подвійна':                     'Double',
  'Ванільний':                    'Vanilla',
  'Полуничний':                   'Strawberry',
  'Карамельний':                  'Caramel',
  'Манговий':                     'Mango',
  'Карамельний соус':             'Caramel Sauce',
  'Свіжі ягоди':                  'Fresh Berries',
  'Горіхова крихта':              'Nut Crumble',
  'З лимоном та зеленню':         'With Lemon & Herbs',
  'З овочами гриль':              'With Grilled Vegetables',
  'З каперсами':                  'With Capers',
  'Ванільне морозиво':            'Vanilla Ice Cream',
  'Збиті вершки':                 'Whipped Cream',
  'Буряк':                'Beetroot',
  'Капуста':              'Cabbage',
  'Морква':               'Carrots',
  'Сметана':              'Sour Cream',
  'Часник':               'Garlic',
  'Риба':                 'Fish',
  'Картопля':             'Potato',
  'Цибуля':               'Onion',
  'Петрушка':             'Parsley',
  'Гриби':                'Mushrooms',
  'Вершки':               'Cream',
  'Вершкове масло':       'Butter',
  'Гарбуз':               'Pumpkin',
  'Імбир':                'Ginger',
  'Кокосове молоко':      'Coconut Milk',
  'Романо':               'Romaine',
  'Пармезан':             'Parmesan',
  'Сухарики':             'Croutons',
  'Соус Цезар':           'Caesar Sauce',
  'Огірок':               'Cucumber',
  'Томат':                'Tomato',
  'Маслини':              'Olives',
  'Квасоля':              'Beans',
  'Тунець':               'Tuna',
  'Яйця':                 'Eggs',
  'Стручкова квасоля':    'Green Beans',
  'Болгарський перець':   'Bell Pepper',
  'Курячі крила':         'Chicken Wings',
  'Паприка':              'Paprika',
  'Олія':                 'Oil',
  'Спеції':               'Spices',
  'Кальмар':              'Squid',
  'Паніровка':            'Breadcrumbs',
  'Борошно':              'Flour',
  'Лимон':                'Lemon',
  'Курка':                'Chicken',
  'Сир':                  'Cheese',
  'Зелень':               'Herbs',
  'Яловичина рибай':      'Ribeye Beef',
  'Розмарин':             'Rosemary',
  'Флер де сель':         'Fleur de Sel',
  'Свинина':              'Pork',
  'Телятина':             'Veal',
  'Качка':                'Duck',
  "Тім'ян":               'Thyme',
  'Жир качиний':          'Duck Fat',
  'Кріп':                 'Dill',
  'Дорадо':               'Sea Bream',
  'Тигрові креветки':     'Tiger Prawns',
  'Мідії':                'Mussels',
  'Біле вино':            'White Wine',
  'Мінеральна вода':      'Mineral Water',
  'Лід':                  'Ice',
  "М'ята":                'Mint',
  'Свіжі фрукти':         'Fresh Fruits',
  'Чайне листя':          'Tea Leaves',
  'Вода':                 'Water',
  'Кавові зерна':         'Coffee Beans',
  'Сухофрукти':           'Dried Fruits',
  'Цукор':                'Sugar',
  'Мед':                  'Honey',
  'Маскарпоне':           'Mascarpone',
  'Савоярді':             'Savoiardi',
  'Кава':                 'Coffee',
  'Какао':                'Cocoa',
  'Желатин':              'Gelatin',
  'Ваніль':               'Vanilla',
  'Чорний шоколад':       'Dark Chocolate',
  'Додатковий тунець':    'Extra Tuna',
  'Додатковий сир':       'Extra Cheese',
  'Салатне листя':        'Salad Leaves',
  'Без льоду':            'No Ice',
  'Пампушка extra':       'Extra Garlic Bun',
  'Подвійна сметана':     'Double Sour Cream',
  'Хліб':                 'Bread',
  'Додаткова курка':      'Extra Chicken',
  'Яйце пашот':           'Poached Egg',
  'Додаткова фета':       'Extra Feta',
  'Хліб піта':            'Pita Bread',
  'Додатковий соус':      'Extra Sauce',
  'Стебла селери':        'Celery Sticks',
  'Перечний соус':        'Pepper Sauce',
  'Гриби гриль':          'Grilled Mushrooms',
  'Спаржа':               'Asparagus',
  'Гірчиця Діжон':        'Dijon Mustard',
  'Журавлинний соус':     'Cranberry Sauce',
  'Соус тандурі':         'Tandoori Sauce',
  'Лаваш':                'Lavash',
  'Свіжі овочі':          'Fresh Vegetables',
  'Соус тартар':          'Tartar Sauce',
  'Овочі на гарнір':      'Vegetables as Side',
  'Соус айолі':           'Aioli Sauce',
  'Без цукру':            'No Sugar',
  'Мед замість цукру':    'Honey Instead of Sugar',
  'З імбиром':            'With Ginger',
  'Ароматний сироп':      'Flavored Syrup',
  'Подвійне молоко':      'Extra Milk',
  'Кулька морозива':      'Scoop of Ice Cream',
  'Ягідний соус':         'Berry Sauce',
};

function nameT(uk, useEn = true) {
  const t = {};
  setTranslationEntry(t, 'uk', 'name', uk, true);
  if (useEn) {
    const en = NAME_EN[uk];
    if (en) setTranslationEntry(t, 'en', 'name', en, true);
  }
  return t;
}

function itemT(nameUk, nameEn, descUk, descEn, weightUk, weightEn, useEn = true) {
  const t = {};
  setTranslationEntry(t, 'uk', 'name',        nameUk, true);
  setTranslationEntry(t, 'uk', 'description', descUk, true);
  if (weightUk) setTranslationEntry(t, 'uk', 'weight', weightUk, true);
  if (useEn) {
    setTranslationEntry(t, 'en', 'name',        nameEn, true);
    setTranslationEntry(t, 'en', 'description', descEn, true);
    if (weightEn) setTranslationEntry(t, 'en', 'weight', weightEn, true);
  }
  return t;
}

function buildT(pairs) {
  const t = {};
  for (const [lang, field, value] of pairs) setTranslationEntry(t, lang, field, value, true);
  return t;
}

// ── shared component-option templates ─────────────────────────────────────────
const OPT_GARNIR = [
  { name: 'Картопляне пюре', p: 0  },
  { name: 'Рис',              p: 0  },
  { name: 'Картопля фрі',    p: 0  },
  { name: 'Овочі гриль',     p: 15 },
];
const OPT_DONENESS_FULL = [
  { name: 'Rare',        p: 0 },
  { name: 'Medium Rare', p: 0 },
  { name: 'Medium',      p: 0 },
  { name: 'Well Done',   p: 0 },
];
const OPT_DONENESS_SHORT = [
  { name: 'Medium',    p: 0 },
  { name: 'Well Done', p: 0 },
];

// ── category definitions (shared) — each category has a distinct accent colour ─
const CAT_DEFS = [
  { name: 'Супи',                 sortOrder: 1, color: '#dc2626', imageUrl: img('soup-C9DibAhz.jpg')     },
  { name: 'Салати',               sortOrder: 2, color: '#16a34a', imageUrl: img('salad-CIn9hhLE.png')    },
  { name: 'Гарячі закуски',       sortOrder: 3, color: '#d97706', imageUrl: GENERIC                      },
  { name: "М'ясні страви",        sortOrder: 4, color: '#b91c1c', imageUrl: img('main-emFvCAQl.jpg')     },
  { name: 'Риба та морепродукти', sortOrder: 5, color: '#0891b2', imageUrl: GENERIC                      },
  { name: 'Напої',                sortOrder: 6, color: '#2563eb', imageUrl: img('drinks-BeAoi6m9.jpg')   },
  { name: 'Десерти',              sortOrder: 7, color: '#9333ea', imageUrl: img('desserts-CGVlTHJO.jpg') },
];

// ── weight per menu item (indexed by MENU_DEFS position) — [uk, en] ───────────
const WEIGHTS = [
  ['350 мл', '350ml'],  ['400 мл', '400ml'],  ['350 мл', '350ml'],  ['350 мл', '350ml'],
  ['250 г',  '250g'],   ['230 г',  '230g'],   ['200 г',  '200g'],   ['260 г',  '260g'],
  ['220 г',  '220g'],   ['400 г',  '400g'],   ['250 г',  '250g'],   ['200 г',  '200g'],
  ['200 г',  '200g'],   ['300 г',  '300g'],   ['250 г',  '250g'],   ['280 г',  '280g'],
  ['300 г',  '300g'],   ['260 г',  '260g'],   ['200 г',  '200g'],   ['250 г',  '250g'],
  ['450 г',  '450g'],   ['300 г',  '300g'],   ['400 г',  '400g'],   ['500 мл', '500ml'],
  ['300 мл', '300ml'],  ['400 мл', '400ml'],  ['200 мл', '200ml'],  ['500 мл', '500ml'],
  ['180 г',  '180g'],   ['150 г',  '150g'],   ['140 г',  '140g'],   ['160 г',  '160g'],
];

// ── 32 menu definitions ───────────────────────────────────────────────────────
const MENU_DEFS = [
  // ── Супи  catIdx=0 ────────────────────────────────────────────────────────
  /*  0 */ ['Борщ з пампушками',   'Класичний борщ зі сметаною та пампушками з часником', 85,  0, 1,
    ['Буряк', 'Капуста', 'Морква', 'Сметана', 'Часник'],
    [['Пампушка extra', 15], ['Подвійна сметана', 20]],
    ["М'ясо у борщ", false, [{ name: "Без м'яса", p:0 }, { name:'Яловичина', p:40 }, { name:'Свинячі реберця', p:55 }]],
    img('borsh-DmE0b-31.png'), 'Borscht with Garlic Buns',
    'Classic borscht with sour cream and garlic buns'],
  /*  1 */ ['Юшка рибна',          'Ароматний рибний бульйон з овочами та зеленню',        95,  0, 2,
    ['Риба', 'Картопля', 'Морква', 'Цибуля', 'Петрушка'],
    [['Хліб', 15], ['Лимон', 10]],
    ['Вид риби', true, [{ name:'Короп', p:0 }, { name:'Судак', p:20 }, { name:'Форель', p:35 }]],
    GENERIC, 'Fish Soup',
    'Aromatic fish broth with vegetables and fresh herbs'],
  /*  2 */ ['Крем-суп грибний',    'Ніжний крем-суп з білих грибів та вершків',            110, 0, 3,
    ['Гриби', 'Вершки', 'Цибуля', 'Вершкове масло', 'Часник'],
    [['Хліб', 15], ['Трюфельна олія', 45]],
    ['Топінг', false, [{ name:'Грінки', p:0 }, { name:'Бекон', p:30 }, { name:'Трюфельна олія', p:45 }]],
    img('mushroom-Z2Rhajax.jpg'), 'Mushroom Cream Soup',
    'Delicate cream soup of white mushrooms and cream'],
  /*  3 */ ['Суп-пюре з гарбуза',  "Оксамитовий гарбузовий суп з імбиром і кокосом",       100, 0, 4,
    ['Гарбуз', 'Морква', 'Цибуля', 'Імбир', 'Кокосове молоко'],
    [['Хліб', 20], ['Сметана', 15]],
    ['Подача', false, [{ name:'З насінням гарбуза', p:0 }, { name:'З беконом', p:30 }, { name:'З вершками', p:15 }]],
    GENERIC, 'Pumpkin Cream Soup',
    'Velvety pumpkin soup with ginger and coconut milk'],
  // ── Салати  catIdx=1 ──────────────────────────────────────────────────────
  /*  4 */ ['Салат Цезар',         'Романо, пармезан, сухарики, соус Цезар',                145, 1, 1,
    ['Куряча грудка', 'Романо', 'Пармезан', 'Сухарики', 'Соус Цезар'],
    [['Додаткова курка', 45], ['Бекон', 35], ['Яйце пашот', 25]],
    ['Протеїн', true, [{ name:'Куряча грудка', p:0 }, { name:'Бекон', p:10 }, { name:'Лосось', p:45 }]],
    img('chezar-CyA4ZrIK.jpg'), 'Caesar Salad',
    'Romaine lettuce, parmesan, croutons, Caesar dressing'],
  /*  5 */ ['Грецький салат',      'Огірок, томат, маслини, фета, червона цибуля',           135, 1, 2,
    ['Фета', 'Огірок', 'Томат', 'Маслини', 'Цибуля'],
    [['Додаткова фета', 30], ['Хліб піта', 20]],
    ['Заправка', false, [{ name:'Оливкова олія', p:0 }, { name:'Лимонна заправка', p:0 }, { name:'Йогуртова', p:10 }]],
    img('greek-HdJti0zt.jpg'), 'Greek Salad',
    'Cucumber, tomato, olives, feta cheese, red onion'],
  /*  6 */ ['Вінегрет',            'Буряк, картопля, морква, квасоля, солоний огірок',        75,  1, 3,
    ['Буряк', 'Картопля', 'Морква', 'Квасоля', 'Огірок'],
    [['Хліб', 15]],
    ['Заправка', false, [{ name:'Соняшникова олія', p:0 }, { name:'Оливкова олія', p:15 }]],
    GENERIC, 'Vinaigrette Salad',
    'Beetroot, potato, carrot, beans, pickled cucumber'],
  /*  7 */ ['Салат Нісуаз',        'Тунець, стручкова квасоля, яйця, маслини, томат',         155, 1, 4,
    ['Тунець', 'Яйця', 'Стручкова квасоля', 'Маслини', 'Томат'],
    [['Додатковий тунець', 55], ['Хліб', 15]],
    ['Вид тунця', true, [{ name:'Консервований тунець', p:0 }, { name:'Свіжий тунець', p:55 }]],
    GENERIC, 'Niçoise Salad',
    'Tuna, green beans, eggs, olives, tomato'],
  /*  8 */ ['Шопський салат',      'Огірок, томат, перець, цибуля, сир бринза',               120, 1, 5,
    ['Бринза', 'Огірок', 'Томат', 'Болгарський перець', 'Цибуля'],
    [['Хліб', 15], ['Додатковий сир', 30]],
    ['Вид сиру', false, [{ name:'Бринза', p:0 }, { name:'Фета', p:15 }, { name:'Сулугуні', p:20 }]],
    GENERIC, 'Shopska Salad',
    'Cucumber, tomato, bell pepper, onion, brynza cheese'],
  // ── Гарячі закуски  catIdx=2 ──────────────────────────────────────────────
  /*  9 */ ['Крила курячі',        'Хрусткі курячі крила у маринаді на вибір (400г)',          195, 2, 1,
    ['Курячі крила', 'Часник', 'Паприка', 'Олія', 'Спеції'],
    [['Додатковий соус', 20], ['Стебла селери', 25]],
    ['Соус', true, [{ name:'BBQ', p:0 }, { name:'Гостро-солодкий', p:0 }, { name:"Медово-гірчичний", p:0 }, { name:'Часниковий', p:0 }]],
    GENERIC, 'Chicken Wings',
    'Crispy chicken wings in your choice of marinade (400g)'],
  /* 10 */ ['Кальмар у клярі',     'Кільця кальмара в золотистому клярі з соусом',             185, 2, 2,
    ['Кальмар', 'Яйця', 'Борошно', 'Паніровка', 'Лимон'],
    [['Лимон', 10], ['Додатковий соус', 20]],
    ['Соус для подачі', true, [{ name:'Тартар', p:0 }, { name:'Часниковий айолі', p:0 }, { name:'Гострий чилі', p:0 }]],
    GENERIC, 'Calamari in Batter',
    'Calamari rings in golden batter with dipping sauce'],
  /* 11 */ ['Жульєн',              'Запечений жульєн з грибами у вершковому соусі',             155, 2, 3,
    ['Гриби', 'Вершки', 'Цибуля', 'Сир', 'Курка'],
    [['Хліб', 15]],
    ['Начинка', true, [{ name:'Курка та гриби', p:0 }, { name:'Морепродукти', p:55 }, { name:'Тільки гриби', p:-20 }]],
    img('mushroom-Z2Rhajax.jpg'), 'Julienne',
    'Baked julienne with mushrooms in cream sauce'],
  /* 12 */ ['Сирні кульки',        'Хрусткі кульки з розтопленим сиром і зеленню',              145, 2, 4,
    ['Сир', 'Яйця', 'Борошно', 'Паніровка', 'Зелень'],
    [['Додатковий соус', 20], ['Салатне листя', 15]],
    ['Соус', true, [{ name:'Журавлинний', p:0 }, { name:'Часниковий', p:0 }, { name:'Томатний', p:0 }]],
    GENERIC, 'Cheese Balls',
    'Crispy deep-fried balls with melted cheese and herbs'],
  // ── М'ясні страви  catIdx=3 ───────────────────────────────────────────────
  /* 13 */ ['Рибай стейк',         'Преміальний стейк рибай з розмарином та маслом (300г)',     520, 3, 1,
    ['Яловичина рибай', 'Розмарин', 'Часник', 'Вершкове масло', 'Флер де сель'],
    [['Гарнір', 50], ['Перечний соус', 35], ['Гриби гриль', 45], ['Спаржа', 55]],
    ['Ступінь прожарки', true, OPT_DONENESS_FULL],
    img('main-emFvCAQl.jpg'), 'Ribeye Steak',
    'Premium ribeye steak with rosemary and herb butter (300g)'],
  /* 14 */ ['Свиняча відбивна',    'Соковита відбивна зі свинини у паніровці (250г)',           265, 3, 2,
    ['Свинина', 'Яйця', 'Паніровка', 'Часник', 'Розмарин'],
    [['Гарнір', 45], ['Гірчиця Діжон', 20]],
    ['Ступінь прожарки', true, OPT_DONENESS_SHORT],
    img('shnitzel-DZIXi6mP.jpg'), 'Pork Schnitzel',
    'Juicy breaded pork schnitzel (250g)'],
  /* 15 */ ['Котлета по-київськи', 'Класична котлета по-київськи з маслом та зеленню',          245, 3, 3,
    ['Куряча грудка', 'Вершкове масло', 'Паніровка', 'Яйця', 'Петрушка'],
    [['Соус', 25], ['Хліб', 15]],
    ['Гарнір', true, OPT_GARNIR],
    img('kotleta-BtnT-3vs.jpg'), 'Chicken Kyiv',
    'Classic chicken Kyiv with herb butter filling'],
  /* 16 */ ['Шашлик зі свинини',  'Соковитий шашлик з маринованої свинини (300г)',             280, 3, 4,
    ['Свинина', 'Цибуля', 'Спеції', 'Лимон', 'Петрушка'],
    [['Соус тандурі', 25], ['Лаваш', 20], ['Свіжі овочі', 35]],
    ['Гарнір', true, OPT_GARNIR],
    GENERIC, 'Pork Shashlik',
    'Juicy marinated pork skewers (300g)'],
  /* 17 */ ['Качина конфі',       'Ніжна качина ніжка конфі з хрусткою скоринкою',             345, 3, 5,
    ['Качка', 'Часник', "Тім'ян", 'Жир качиний', 'Вершкове масло'],
    [['Журавлинний соус', 30], ['Овочі гриль', 45]],
    ['Гарнір', true, [{ name:'Картопляне пюре', p:0 }, { name:'Рис з овочами', p:0 }, { name:'Тушкована капуста', p:0 }]],
    GENERIC, 'Duck Confit',
    'Tender slow-cooked duck leg confit with crispy skin'],
  /* 18 */ ['Телятина відбивна',  'Ніжна телятина у паніровці зі свіжим лимоном (200г)',       310, 3, 6,
    ['Телятина', 'Яйця', 'Паніровка', 'Лимон', 'Петрушка'],
    [['Гарнір', 45], ['Соус', 25]],
    ['Ступінь прожарки', true, OPT_DONENESS_FULL],
    img('shnitzel-DZIXi6mP.jpg'), 'Veal Schnitzel',
    'Tender breaded veal with fresh lemon (200g)'],
  // ── Риба та морепродукти  catIdx=4 ────────────────────────────────────────
  /* 19 */ ['Лосось на грилі',    'Стейк лосося на грилі з лимоном та кропом (250г)',          385, 4, 1,
    ['Лосось', 'Лимон', 'Кріп', 'Оливкова олія', 'Часник'],
    [['Соус тартар', 30], ['Лимон', 10]],
    ['Гарнір', true, OPT_GARNIR],
    GENERIC, 'Grilled Salmon',
    'Grilled salmon steak with lemon and dill (250g)'],
  /* 20 */ ['Дорадо запечена',    'Ціла дорадо запечена з розмарином і часником',              395, 4, 2,
    ['Дорадо', 'Лимон', 'Розмарин', 'Часник', 'Оливкова олія'],
    [['Овочі на гарнір', 45], ['Соус', 30]],
    ['Подача', false, [{ name:'З лимоном та зеленню', p:0 }, { name:'З овочами гриль', p:35 }, { name:'З каперсами', p:25 }]],
    GENERIC, 'Baked Sea Bream',
    'Whole sea bream baked with rosemary and garlic'],
  /* 21 */ ['Тигрові креветки',   'Тигрові креветки на вибір подачі (300г)',                    355, 4, 3,
    ['Тигрові креветки', 'Часник', 'Вершкове масло', 'Лимон', 'Петрушка'],
    [['Хліб', 20], ['Соус айолі', 25], ['Лимон', 10]],
    ['Спосіб подачі', true, [{ name:'Гриль', p:0 }, { name:'У часниковому соусі', p:0 }, { name:'У вершково-часниковому соусі', p:20 }]],
    GENERIC, 'Tiger Prawns',
    'Tiger prawns prepared your way (300g)'],
  /* 22 */ ['Мідії у соусі',      'Мідії у соусі на вибір з хлібом для подачі (400г)',         295, 4, 4,
    ['Мідії', 'Часник', 'Вершки', 'Петрушка', 'Біле вино'],
    [['Хліб', 20], ['Лимон', 10]],
    ['Соус', true, [{ name:'Вершково-часниковий', p:0 }, { name:'Томатний', p:0 }, { name:'Біле вино та зелень', p:0 }]],
    GENERIC, 'Mussels in Sauce',
    'Mussels in your choice of sauce served with bread (400g)'],
  // ── Напої  catIdx=5 ───────────────────────────────────────────────────────
  /* 23 */ ['Лимонад',            'Домашній лимонад на вибір смаку (500 мл)',                   75,  5, 1,
    ['Лимон', 'Цукор', 'Мінеральна вода', 'Лід', "М'ята"],
    [['Без цукру', 0], ['Мед замість цукру', 10]],
    ['Смак', true, [{ name:'Класичний', p:0 }, { name:'Полуниця', p:0 }, { name:'Маракуя', p:0 }, { name:"М'ята та огірок", p:0 }]],
    img('lemonade-CJvO78ox.jpg'), 'Lemonade',
    'Homemade lemonade in your choice of flavor (500ml)'],
  /* 24 */ ['Свіжий сік',         'Свіжовичавлений сік на вибір (300 мл)',                      85,  5, 2,
    ['Свіжі фрукти', 'Лід'],
    [['Без льоду', 0], ['З імбиром', 15]],
    ['Вид соку', true, [{ name:'Апельсиновий', p:0 }, { name:'Яблучний', p:0 }, { name:'Морквяний', p:0 }, { name:'Гранатовий', p:0 }]],
    GENERIC, 'Fresh Juice',
    'Freshly squeezed juice of your choice (300ml)'],
  /* 25 */ ['Чай',                'Чай на вибір виду з медом та лимоном (400 мл)',              45,  5, 3,
    ['Чайне листя', 'Вода'],
    [['Мед', 15], ['Лимон', 10], ["М'ята", 10]],
    ['Вид чаю', true, [{ name:'Чорний', p:0 }, { name:'Зелений', p:0 }, { name:"Трав'яний", p:0 }, { name:'Фруктовий', p:0 }]],
    img('tea-Bx1USpaV.png'), 'Tea',
    'Tea of your choice with honey and lemon (400ml)'],
  /* 26 */ ['Кава',               'Кава на вибір способу приготування',                         55,  5, 4,
    ['Кавові зерна', 'Вода'],
    [['Ароматний сироп', 15], ['Подвійне молоко', 10]],
    ['Вид кави', true, [{ name:'Еспресо', p:0 }, { name:'Американо', p:0 }, { name:'Капучино', p:10 }, { name:'Латте', p:15 }]],
    GENERIC, 'Coffee',
    'Coffee prepared your way'],
  /* 27 */ ['Компот',             'Домашній компот з сухофруктів (500 мл)',                     40,  5, 5,
    ['Сухофрукти', 'Вода', 'Цукор'],
    [['Лимон', 10], ['Мед', 15]],
    ['Температура', false, [{ name:'Холодний', p:0 }, { name:'Теплий', p:0 }]],
    GENERIC, 'Fruit Compote',
    'Homemade dried fruit compote (500ml)'],
  // ── Десерти  catIdx=6 ─────────────────────────────────────────────────────
  /* 28 */ ['Медовик',            'Торт Медовик зі сметанним кремом (кусочок)',                 95,  6, 1,
    ['Мед', 'Борошно', 'Яйця', 'Сметана', 'Вершки'],
    [['Кулька морозива', 35], ['Ягідний соус', 25]],
    ['Топінг', false, [{ name:'Карамельний соус', p:0 }, { name:'Свіжі ягоди', p:20 }, { name:'Горіхова крихта', p:15 }]],
    img('cheesecake-B_FN3sMf.jpg'), 'Honey Cake',
    'Medovyk honey layer cake with sour cream frosting (slice)'],
  /* 29 */ ['Тірамісу',           'Класичне тірамісу з маскарпоне та кавою',                   115, 6, 2,
    ['Маскарпоне', 'Савоярді', 'Кава', 'Яйця', 'Какао'],
    [['Кулька морозива', 35]],
    ['Порція', true, [{ name:'Стандартна', p:0 }, { name:'Подвійна', p:80 }]],
    img('tiramisu-Twwxf11g.png'), 'Tiramisu',
    'Classic tiramisu with mascarpone and espresso'],
  /* 30 */ ['Панакота',           'Ніжна панакота зі соусом на вибір',                         105, 6, 3,
    ['Вершки', 'Желатин', 'Цукор', 'Ваніль'],
    [['Свіжі ягоди', 30], ["М'ята", 10]],
    ['Соус', true, [{ name:'Ванільний', p:0 }, { name:'Полуничний', p:0 }, { name:'Карамельний', p:0 }, { name:'Манговий', p:15 }]],
    GENERIC, 'Panna Cotta',
    'Delicate panna cotta with your choice of sauce'],
  /* 31 */ ['Шоколадний фондан',  'Теплий шоколадний фондан з рідкою серединкою',              125, 6, 4,
    ['Чорний шоколад', 'Вершкове масло', 'Яйця', 'Борошно', 'Цукор'],
    [['Кулька морозива', 35], ['Ягідний соус', 25]],
    ['Топінг', true, [{ name:'Ванільне морозиво', p:0 }, { name:'Збиті вершки', p:-10 }, { name:'Карамельний соус', p:0 }]],
    GENERIC, 'Chocolate Fondant',
    'Warm chocolate fondant with molten center'],
];

// ── order patterns — full menu (all 32 items, used by premium restaurant) ──────
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

// ── order patterns — 5-category menu (items 0-22 only, used by free restaurant) ─
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

const ACTIVE_PATTERNS      = [4, 1, 8, 6];
const ACTIVE_STATUSES      = ['open', 'open', 'open', 'open'];
const ACTIVE_DISH_STATUSES = [
  ['cooking', 'waiting'],
  ['waiting'],
  ['ready',   'ready'],
  ['cooking', 'waiting'],
];

// ── review text templates ─────────────────────────────────────────────────────
const DISH_CMTS = {
  5: ['Чудова страва! Все бездоганно.', 'Неймовірно смачно, прийду ще!', 'Майстерня кухня, дякую!'],
  4: ['Дуже добре, рекомендую.', 'Смачно і гарна подача.', 'Задоволений, повернусь.'],
  3: ['Непогано, але є куди рости.', 'Нормально для ціни.', 'Прийнятно.'],
};
const REST_CMTS = {
  5: ['Фантастичний ресторан! Обслуговування на висоті.', 'Все чудово — і кухня, і атмосфера!'],
  4: ['Дуже приємне місце, сподобалось.', 'Хороший ресторан, рекомендую друзям.'],
  3: ['Непогано, але сервіс можна покращити.', 'Загалом нормально.'],
};

// ── guest names ───────────────────────────────────────────────────────────────
const GUEST_NAMES = [
  'Олена Бондаренко',   'Максим Кравченко',  'Юлія Лисенко',      'Дмитро Мороз',
  'Тетяна Гончаренко',  'Роман Кузьменко',   'Вікторія Павленко', 'Олексій Ткач',
  'Ірина Дяченко',      'Артем Савченко',    'Наталія Громова',   'Богдан Руденко',
  'Людмила Власенко',   'Ігор Назаренко',    'Олена Марченко',    'Сергій Захарченко',
  'Марина Тимошенко',   'Ярослав Остапенко', 'Ольга Коломієць',   'Андрій Кириленко',
  'Тетяна Мельниченко', 'Микола Мусієнко',   'Валентина Приходько','Євген Романенко',
  'Галина Вернигора',   'Павло Шевченко',    'Надія Кравець',     'Костянтин Литвин',
  'Світлана Яковенко',  'Олег Пилипенко',    'Ганна Сірко',       'Василь Товстоліс',
  'Жанна Ципленко',     'Остап Клименко',    'Соломія Величко',
];

// ── restaurant configs ────────────────────────────────────────────────────────
const RESTAURANT_CONFIGS = [
  {
    _id: 'BR5CH3OK22',
    name: 'Ресторан Борщечок',
    slug: 'borshchechok',
    address: 'вул. Сумська 12, Харків',
    cuisine: 'Українська',
    plan: 'free',
    logoUrl: img('logo-DTwPNw_c.png'),
    nameEn: 'Borshchechok Restaurant',
    cuisineEn: 'Ukrainian',
    staff: [
      { name: 'Олена Шевченко',   email: 'admin@borshchechok.ua',  role: 'root_admin' },
      { name: 'Михайло Гриценко', email: 'cook1@borshchechok.ua',  role: 'cook'   },
      { name: 'Андрій Коваль',    email: 'waiter1@borshchechok.ua',role: 'waiter' },
    ],
    menuCatCount:   5,           // free limit: only Soups, Salads, Hot Apps, Meat, Fish
    menuItemFilter: def => def[3] < 5,   // catIdx 0-4 only (items 0-22)
    orderPatterns:  FREE_ORDER_PATTERNS,
    includeReviews: false,
    useEn:          false,       // free plan: Ukrainian only
  },
  {
    _id: 'PR3MIUM1',
    name: 'Ресторан Борщечок Преміум',
    slug: 'borshchechok-premium',
    address: 'пр. Науки 22, Харків',
    cuisine: 'Українська',
    plan: 'premium',
    logoUrl: img('logo-DTwPNw_c.png'),
    nameEn: 'Borshchechok Premium Restaurant',
    cuisineEn: 'Ukrainian',
    staff: [
      { name: 'Соломія Іваненко', email: 'admin@premium.ua',       role: 'root_admin'  },
      { name: 'Василь Ковальчук', email: 'cook1@premium.ua',       role: 'cook'        },
      { name: 'Тетяна Бойченко',  email: 'waitercook@premium.ua',  role: 'waiter_cook' },
      { name: 'Роман Петренко',   email: 'waiter1@premium.ua',     role: 'waiter'      },
      { name: 'Катерина Мельник', email: 'waiter2@premium.ua',     role: 'waiter'      },
    ],
    menuCatCount:   7,           // premium: all 7 categories
    menuItemFilter: () => true,  // all 32 items
    orderPatterns:  ORDER_PATTERNS,
    includeReviews: true,
    useEn:          true,        // premium: both Ukrainian and English
  },
];

// ── helpers ───────────────────────────────────────────────────────────────────
function log(label, n) {
  console.log(`  ✓  ${ label.padEnd(30) }${n}`);
}

async function dropAll(db) {
  for (const n of [
    'restaurants','users','tables','sessions','categories','menuitems',
    'ingredients','addons','componentgroups','componentoptions',
    'orders','orderitems','servinggroups','payments','auditlogs',
    'waitercalls','restaurantreviews','dishreviews','tokenblacklists',
  ]) { try { await db.collection(n).deleteMany({}); } catch {} }
}

function getDay(idx)      { return Math.min(6, Math.floor(idx / 7)); }
function getTableIdx(idx) { return idx % 5; }

function getGuestIdx(i) {
  if (i >= 46) return i - 46;
  if (i < 30)  return 4 + Math.floor(i / 2);
  return 19 + (i - 30);
}

function getOrderTime(day, seed) {
  const h = 11 + (seed % 9);
  const m = (seed * 13) % 60;
  return new Date(BASE_DATE.getTime() + day * DAY_MS + h * HOUR_MS + m * MIN_MS);
}

function getGroupStatusChangedAt(dishStatus, orderDate, i, sgIdx) {
  if (dishStatus === 'waiting') return null;
  if (dishStatus === 'cooking') return new Date(orderDate.getTime() + 4 * MIN_MS);
  if (dishStatus === 'ready')   return new Date(orderDate.getTime() + 10 * MIN_MS);
  if (dishStatus === 'served') {
    const offset = 25 + sgIdx * 8 + (i % 10);
    return new Date(orderDate.getTime() + offset * MIN_MS);
  }
  return null;
}

function buildItemPayload(entry, qty, dishStatus, seed) {
  const { item } = entry;
  const removable = (item.ingredients || []).filter(i => i.isRemovable);
  const numExcl = seed % 4 === 1 ? Math.min(1, removable.length)
                : seed % 4 === 2 ? Math.min(2, removable.length)
                : 0;
  const excludedIngredients = removable.slice(0, numExcl).map(i => ({ _id: i._id, name: i.name }));

  const componentGroupChoices = [];
  const availableGroups = (item.componentGroups || []).filter(g => g.isAvailable !== false && (g.options || []).length > 0);
  for (const g of availableGroups) {
    const optIdx = seed % 6 === 5 ? 0 : seed % g.options.length;
    const opt = g.options[optIdx];
    componentGroupChoices.push({
      groupId: g._id,
      groupName: g.name,
      optionId: opt._id,
      optionName: opt.name,
      priceModifier: opt.priceModifier || 0,
    });
  }

  const addons = [];
  const availableAddons = (item.addons || []).filter(a => a.isAvailable !== false);
  if (availableAddons.length > 0 && seed % 4 === 0) {
    addons.push({ _id: availableAddons[0]._id, name: availableAddons[0].name, price: availableAddons[0].price, quantity: 1 });
  }
  if (availableAddons.length > 1 && seed % 9 === 3) {
    addons.push({ _id: availableAddons[1]._id, name: availableAddons[1].name, price: availableAddons[1].price, quantity: 1 });
  }

  return { menuItemId: item._id, menuItemName: item.name, quantity: qty, unitPrice: item.basePrice, dishStatus, excludedIngredients, componentGroupChoices, addons };
}

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

function fmtDate(d) {
  return d.toLocaleDateString('uk-UA', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTime(d) {
  return d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
}

// ── per-restaurant seeding functions ─────────────────────────────────────────

async function seedMenuForRestaurant(rId, { catCount = 7, itemFilter = () => true, useEn = true } = {}) {
  // Fresh pools per restaurant — no cross-contamination of MongoDB IDs
  const ingPool   = new Map();
  const addonPool = new Map();
  const groupPool = new Map();

  async function ensureIngredient(name) {
    const key = name.toLowerCase();
    if (ingPool.has(key)) return ingPool.get(key);
    const doc = await Ingredient.create({ name, isRemovable: true, isAvailable: true, restaurantId: rId, translations: nameT(name, useEn) });
    ingPool.set(key, doc);
    return doc;
  }

  async function ensureAddon(name, price) {
    const key = `${name.toLowerCase()}::${price}`;
    if (addonPool.has(key)) return addonPool.get(key);
    const doc = await AddOn.create({ name, price, isAvailable: true, restaurantId: rId, translations: nameT(name, useEn) });
    addonPool.set(key, doc);
    return doc;
  }

  async function ensureGroup(groupName, isRequired, optDefs) {
    const key = groupName.toLowerCase();
    if (groupPool.has(key)) return groupPool.get(key);
    const grp  = await ComponentGroup.create({ name: groupName, isRequired: !!isRequired, sortOrder: 1, isAvailable: true, restaurantId: rId, translations: nameT(groupName, useEn) });
    const opts = await Promise.all(
      optDefs.map((o, idx) => ComponentOption.create({ componentGroupId: grp._id, name: o.name, priceModifier: o.p ?? 0, isDefault: idx === 0, translations: nameT(o.name, useEn) }))
    );
    groupPool.set(key, { grp, opts });
    return { grp, opts };
  }

  const cats = await Promise.all(
    CAT_DEFS.slice(0, catCount).map(c => Category.create({ ...c, restaurantId: rId, translations: nameT(c.name, useEn) }))
  );

  const catalog = [];
  for (let mIdx = 0; mIdx < MENU_DEFS.length; mIdx++) {
    const def = MENU_DEFS[mIdx];
    if (!itemFilter(def)) continue;
    const [name, desc, price, catIdx, sort, ingNames, aoRows, grpDef, imageUrl, name_en, desc_en] = def;
    const [weightUk, weightEn] = WEIGHTS[mIdx] || ['', ''];

    const embeddedIngredients = [];
    for (let ii = 0; ii < ingNames.length; ii++) {
      const n = ingNames[ii];
      const source = await ensureIngredient(n);
      embeddedIngredients.push({ name: n, name_en: useEn ? (NAME_EN[n] || '') : '', isRemovable: ii > 0, isAvailable: true, sourceId: source._id });
    }

    const embeddedAddons = [];
    for (const [n, p] of aoRows) {
      const source = await ensureAddon(n, p);
      embeddedAddons.push({ name: n, name_en: useEn ? (NAME_EN[n] || '') : '', price: p, isAvailable: true, sourceId: source._id });
    }

    const [grpName, grpReq, optDefs] = grpDef;
    const globalGroup = await ensureGroup(grpName, grpReq, optDefs);
    const embeddedGroup = {
      name: grpName, name_en: useEn ? (NAME_EN[grpName] || '') : '',
      isRequired: !!grpReq, isAvailable: true, sourceId: globalGroup.grp._id,
      options: optDefs.map((o, idx) => ({
        name: o.name, name_en: useEn ? (NAME_EN[o.name] || '') : '',
        priceModifier: o.p ?? 0, isDefault: idx === 0,
        sourceId: globalGroup.opts[idx]?._id || null,
      })),
    };

    const item = await MenuItem.create({
      name, description: desc, basePrice: price, weight: weightUk,
      categoryId: cats[catIdx]._id, restaurantId: rId,
      isAvailable: true, sortOrder: sort, imageUrl,
      translations: itemT(name, name_en, desc, desc_en, weightUk, weightEn, useEn),
      ingredients: embeddedIngredients,
      addons: embeddedAddons,
      componentGroups: [embeddedGroup],
    });
    catalog.push({ item });
  }

  return { cats, catalog };
}

async function seedOrdersForRestaurant({ rId, restPrefix, catalog, guests, allTables, activeTables, activeSessions, staffWaiters, includeReviews, orderPatterns, restIdx = 0 }) {
  let ordersCreated = 0, paymentsCreated = 0, dishRevCreated = 0, restRevCreated = 0, auditLogsCreated = 0;
  let waiterCallOrder = null, cashCallOrder = null, questionOrder = null;

  // ── Build 30-day order plan ────────────────────────────────────────────────
  //   • Past 29 days: 6-10 completed (mix of cash/epay) + occasional cancelled
  //   • Today: ~8 completed orders earlier in the day + 4 active orders right now
  const plan = [];
  for (let dayBack = 29; dayBack >= 1; dayBack--) {
    const count = 6 + ((dayBack * 3) % 5);   // deterministic 6-10
    for (let n = 0; n < count; n++) {
      plan.push({ dayBack, slot: n, isActive: false, activeIdx: -1 });
    }
  }
  // Today — completed orders during the day
  for (let n = 0; n < 8; n++) {
    plan.push({ dayBack: 0, slot: n, isActive: false, activeIdx: -1 });
  }
  // Today — active orders right now
  for (let n = 0; n < 4; n++) {
    plan.push({ dayBack: 0, slot: 100 + n, isActive: true, activeIdx: n });
  }

  for (let i = 0; i < plan.length; i++) {
    const entry     = plan[i];
    const isActive  = entry.isActive;
    const activeIdx = entry.activeIdx;
    // Active orders use a restaurant-specific slice of the guest pool so that
    // the same userId never appears in two live orders across restaurants —
    // matching the new "one active order per account" constraint.
    const guestIdx = isActive
      ? (restIdx * 4 + activeIdx) % guests.length
      : i % guests.length;
    const guest = guests[guestIdx];

    let tableObj, sessionToken, orderStatus, orderDate;

    if (isActive) {
      tableObj     = activeTables[activeIdx];
      sessionToken = activeSessions[activeIdx].token;
      orderStatus  = ACTIVE_STATUSES[activeIdx];
      orderDate    = new Date(NOW.getTime() + ACTIVE_OFFSETS_MIN[activeIdx] * MIN_MS);
    } else {
      tableObj = allTables[i % allTables.length];
      const dayStart = new Date(todayMidnight.getTime() - entry.dayBack * DAY_MS);
      const h = 11 + ((i * 3 + entry.slot * 2) % 10);    // 11:00 – 20:59
      const m = (i * 17 + entry.slot * 11) % 60;
      orderDate = new Date(dayStart.getTime() + h * HOUR_MS + m * MIN_MS);
      const sess = await Session.create({
        tableId: tableObj._id, restaurantId: rId,
        isActive: false,
        expiresAt: new Date(orderDate.getTime() + 3 * HOUR_MS),
        createdAt: orderDate,
      });
      sessionToken = sess.token;
      orderStatus = (i % 47 === 7 || i % 53 === 13) ? 'cancelled'
                  : i % 3 === 0                     ? 'completed_cash'
                  :                                   'completed_epay';
    }

    const orderPublicId = seedOrderId(restPrefix, i);
    const orderPayload  = {
      _id: orderPublicId,
      tableId: tableObj._id, restaurantId: rId,
      sessionToken, status: orderStatus,
      userId: guest._id,
      createdAt: orderDate, updatedAt: orderDate,
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
      } else if (isActive) {
        const activeDishStatuses = ACTIVE_DISH_STATUSES[activeIdx] || ['waiting'];
        groupDishStatus = activeDishStatuses[sgIdx] || activeDishStatuses[activeDishStatuses.length - 1];
      } else {
        groupDishStatus = 'waiting';
      }

      const groupStatusChangedAt = getGroupStatusChangedAt(groupDishStatus, orderDate, i, sgIdx);
      const sg = await ServingGroup.create({
        orderId: order._id, name: sgName, sortOrder: sgIdx,
        statusChangedAt: groupStatusChangedAt,
        createdAt: orderDate, updatedAt: groupStatusChangedAt || orderDate,
      });

      for (let dIdx = 0; dIdx < dishPairs.length; dIdx++) {
        const [dishIdx, qty] = dishPairs[dIdx];
        if (dishIdx >= catalog.length) continue;   // skip items missing from filtered menus
        const seed    = i * 100 + sgIdx * 10 + dIdx;
        const payload = buildItemPayload(catalog[dishIdx], qty, groupDishStatus, seed);
        const oi = await OrderItem.create({ orderId: order._id, servingGroupId: sg._id, ...payload });
        allItems.push({ orderItem: oi, entry: catalog[dishIdx] });
      }
    }

    if (['completed_cash', 'completed_epay'].includes(orderStatus)) {
      const orderItems = allItems.map(x => x.orderItem);
      const amount = calcTotal(orderItems);
      const method = orderStatus === 'completed_cash' ? 'cash' : 'online';
      const payDoc = { orderId: order._id, restaurantId: rId, amount, method, status: 'completed' };
      let waiter, transactionId;
      if (method === 'cash') {
        waiter = staffWaiters.length > 1
          ? staffWaiters[i % staffWaiters.length]
          : staffWaiters[0];
        if (waiter) payDoc.processedBy = waiter._id;
      } else {
        transactionId = `liqpay-seed-${restPrefix}-${String(i).padStart(3,'0')}`;
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
        receipt:       auditService.buildReceipt(orderItems, { paidAt: orderDate }),
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

    if (includeReviews && ['completed_cash', 'completed_epay'].includes(orderStatus)) {
      const numRev = i % 3 === 0 ? 0 : i % 3 === 1 ? 1 : 2;
      for (const { orderItem, entry: itemEntry } of allItems.slice(0, numRev)) {
        const rating  = 3 + (i % 3);
        const cmtList = DISH_CMTS[rating];
        await DishReview.create({
          userId: guest._id, orderItemId: orderItem._id,
          menuItemId: itemEntry.item._id, restaurantId: rId,
          rating, comment: cmtList[i % cmtList.length],
        });
        dishRevCreated++;
      }
    }

    if (includeReviews && ['completed_cash', 'completed_epay'].includes(orderStatus) && i % 2 === 0) {
      const rating  = 3 + ((i + 1) % 3);
      const cmtList = REST_CMTS[rating];
      await RestaurantReview.create({
        userId: guest._id, orderId: order._id, restaurantId: rId,
        rating, comment: cmtList[i % cmtList.length],
      });
      restRevCreated++;
    }

    if (isActive && activeIdx === 0) cashCallOrder   = { order, session: activeSessions[activeIdx], table: activeTables[0] };
    if (isActive && activeIdx === 2) waiterCallOrder = { order, session: activeSessions[activeIdx], table: activeTables[2] };
    if (isActive && activeIdx === 3) questionOrder   = { order, session: activeSessions[activeIdx], table: activeTables[3] };
  }

  let waiterCallsCreated = 0;
  if (cashCallOrder) {
    await WaiterCall.create({ tableId: cashCallOrder.table._id, restaurantId: rId, orderId: cashCallOrder.order._id, sessionToken: cashCallOrder.session.token, type: 'cash_payment', status: 'active' });
    waiterCallsCreated++;
  }
  if (waiterCallOrder) {
    await WaiterCall.create({ tableId: waiterCallOrder.table._id, restaurantId: rId, orderId: waiterCallOrder.order._id, sessionToken: waiterCallOrder.session.token, type: 'call', status: 'active' });
    waiterCallsCreated++;
  }
  if (questionOrder) {
    await WaiterCall.create({ tableId: questionOrder.table._id, restaurantId: rId, orderId: questionOrder.order._id, sessionToken: questionOrder.session.token, type: 'call', status: 'active' });
    waiterCallsCreated++;
  }

  return { ordersCreated, paymentsCreated, dishRevCreated, restRevCreated, waiterCallsCreated, auditLogsCreated };
}

async function seedOneRestaurant(config, hash, guests, restIdx = 0) {
  // Restaurant document
  const restTransPairs = [
    ['uk', 'name',    config.name],
    ['uk', 'cuisine', config.cuisine],
  ];
  if (config.useEn) {
    restTransPairs.push(['en', 'name',    config.nameEn]);
    restTransPairs.push(['en', 'cuisine', config.cuisineEn]);
  }
  const restaurant = await Restaurant.create({
    _id: config._id,
    name: config.name, slug: config.slug,
    address: config.address, cuisine: config.cuisine,
    logoUrl: config.logoUrl, isActive: true, plan: config.plan,
    defaultLanguage: 'uk',
    enabledLanguages: config.useEn ? ['uk', 'en'] : ['uk'],
    translations: buildT(restTransPairs),
  });
  const rId = restaurant._id;

  // Staff
  const staff = await Promise.all(
    config.staff.map(s => User.create({ name: s.name, email: s.email, passwordHash: hash, role: s.role, restaurantId: rId }))
  );
  const staffWaiters = staff.filter(s => s.role === 'waiter' || s.role === 'waiter_cook');

  // Tables
  const tableDefs = [
    { number:1, label:'Вікно',   status:'free'     },
    { number:2, label:'Веранда', status:'occupied' },
    { number:3, label:'Центр',   status:'occupied' },
    { number:4, label:'VIP',     status:'occupied' },
    { number:5, label:'Бар',     status:'occupied' },
  ];
  const tables = await Promise.all(
    tableDefs.map(t => Table.create({ ...t, restaurantId: rId }))
  );
  const activeTables = tables.slice(1);  // t2..t5

  // Active sessions (4 tables)
  const activeSessions = await Promise.all(
    activeTables.map(t => Session.create({ tableId: t._id, restaurantId: rId }))
  );

  // Menu
  const { cats, catalog } = await seedMenuForRestaurant(rId, {
    catCount:   config.menuCatCount,
    itemFilter: config.menuItemFilter,
    useEn:      config.useEn,
  });

  const totalItems = catalog.length;
  const totalIngs  = catalog.reduce((s, e) => s + (e.item.ingredients?.length || 0), 0);
  const totalAos   = catalog.reduce((s, e) => s + (e.item.addons?.length || 0), 0);
  const totalGrps  = catalog.reduce((s, e) => s + (e.item.componentGroups?.length || 0), 0);
  const totalOpts  = catalog.reduce((s, e) => s + (e.item.componentGroups || []).reduce((acc, g) => acc + (g.options?.length || 0), 0), 0);

  // Orders, payments, reviews, waiter calls
  const counts = await seedOrdersForRestaurant({
    rId, restPrefix: config._id, catalog, guests,
    allTables: tables, activeTables, activeSessions, staffWaiters,
    includeReviews: config.includeReviews,
    orderPatterns:  config.orderPatterns,
    restIdx,
  });

  return { restaurant, staff, tables, cats, catalog, counts, totalItems, totalIngs, totalAos, totalGrps, totalOpts };
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set in .env');

  console.log(`Connecting to MongoDB…`);
  await mongoose.connect(uri);

  console.log(`\nTime reference: ${fmtDate(NOW)}  ${fmtTime(NOW)}`);
  console.log(`Historical orders span: ${fmtDate(BASE_DATE)}  →  ${fmtDate(todayMidnight)} (30 days, includes today)`);
  console.log(`Today: ~8 completed + 4 active (active arrive –28 m … –12 m from now)\n`);

  console.log('Dropping existing data…');
  await dropAll(mongoose.connection.db);

  const hash = await bcrypt.hash(STAFF_PASSWORD, SALT_ROUNDS);

  // ── Shared guests (35) ────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(55));
  console.log('Seeding shared resources…\n');
  const guests = await Promise.all(
    GUEST_NAMES.map((name, i) =>
      User.create({ name, email: `guest${i + 1}@example.com`, passwordHash: hash, role: 'guest' })
    )
  );
  log('guest users (shared)', 35);

  // ── Seed both restaurants ─────────────────────────────────────────────────
  const results = [];
  for (let restIdx = 0; restIdx < RESTAURANT_CONFIGS.length; restIdx++) {
    const config = RESTAURANT_CONFIGS[restIdx];
    console.log(`\n${'─'.repeat(55)}`);
    console.log(`Seeding: ${config.name}  [plan: ${config.plan}]\n`);
    const r = await seedOneRestaurant(config, hash, guests, restIdx);
    results.push({ config, ...r });

    log('restaurant', 1);
    log(`staff (${config.plan})`, config.staff.length);
    log('tables', 5);
    log('categories', config.menuCatCount);
    log('menu items', r.totalItems);
    log('ingredients', r.totalIngs);
    log('add-ons', r.totalAos);
    log('component groups', r.totalGrps);
    log('component options', r.totalOpts);
    log('sessions (active)', 4);
    log('orders total (30 days)', r.counts.ordersCreated);
    log('payments', r.counts.paymentsCreated);
    log('audit logs (receipts)', r.counts.auditLogsCreated);
    log('dish reviews', r.counts.dishRevCreated);
    log('restaurant reviews', r.counts.restRevCreated);
    log('waiter calls', r.counts.waiterCallsCreated);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(55));
  console.log('✅  Seed complete!\n');

  const base = process.env.BASE_URL || 'http://localhost:5000';

  for (const { config, restaurant, staff, tables } of results) {
    console.log(`${'═'.repeat(55)}`);
    console.log(`RESTAURANT  [${config.plan.toUpperCase()}]`);
    console.log(`  Name    : ${restaurant.name}`);
    console.log(`  id      : ${restaurant._id}  ← use in API URLs`);
    console.log(`  Slug    : ${restaurant.slug}`);
    console.log(`  Address : ${restaurant.address}\n`);

    console.log(`CREDENTIALS  (password: ${STAFF_PASSWORD})`);
    for (const s of staff)
      console.log(`  [${s.role.padEnd(11)}]  ${s.email}`);
    console.log(`  [guest      ]  guest1@example.com … guest35@example.com\n`);

    console.log(`TABLES`);
    const dbTables = await Table.find({ restaurantId: restaurant._id }).sort({ number: 1 }).lean();
    for (const t of dbTables)
      console.log(`  Table ${t.number}  [${t.status.padEnd(10)}]  ${t.shortCode}  →  ${base}/api/qr/${t.shortCode}`);

    console.log(`\nREVIEWS  : ${config.includeReviews ? 'enabled (premium)' : 'disabled (free plan)'}`);
    console.log('');
  }

  console.log(`${'─'.repeat(55)}`);
  console.log(`MENU  (per restaurant)`);
  for (const { config, totalItems } of results)
    console.log(`  ${config.plan.padEnd(8)}  ${config.menuCatCount} categories  ·  ${totalItems} dishes`);

  console.log(`\nORDER STATISTICS  (30-day window per restaurant)`);
  console.log(`  Historical : ${fmtDate(BASE_DATE)} – ${fmtDate(new Date(todayMidnight.getTime() - DAY_MS))} (29 days, 6-10 orders/day)`);
  console.log(`  Today      : ${fmtDate(todayMidnight)}  → 8 completed (earlier today) + 4 active right now`);
  console.log(`  Active     : ${fmtTime(new Date(NOW.getTime() + ACTIVE_OFFSETS_MIN[0] * MIN_MS))}–${fmtTime(new Date(NOW.getTime() + ACTIVE_OFFSETS_MIN[3] * MIN_MS))}`);

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('\n❌  Seed failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
