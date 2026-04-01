import deruni1x1 from '../assets/dishes/deruni1x1.png';
import deruni2 from '../assets/dishes/deruni2.jpg';
import kotleta2 from '../assets/dishes/kotleta2.jpg';
import deruni from '../assets/dishes/deruni.jpg';
import desserts from '../assets/dishes/desserts.jpg';
import drinks from '../assets/dishes/drinks.jpg';
import grechka from '../assets/dishes/grechka.jpg';
import kotleta from '../assets/dishes/kotleta.jpg';
import mPotato from '../assets/dishes/m_potato.jpg';
import main from '../assets/dishes/main.jpg';
import pizza from '../assets/dishes/pizza.png';
import plov from '../assets/dishes/plov.jpg';
import salad from '../assets/dishes/salad.png';
import shnitzel from '../assets/dishes/shnitzel.jpg';
import soup from '../assets/dishes/soup.jpg';
import borsh from '../assets/dishes/borsh.png';
import mushroom from '../assets/dishes/mushroom.jpg';
import spagetti from '../assets/dishes/spagetti.png';
import vareniki from '../assets/dishes/vareniki.jpg';
import chezar from '../assets/dishes/chezar.jpg';
import greek from '../assets/dishes/greek.jpg';
import lemonade from '../assets/dishes/lemonade.jpg';
import tea from '../assets/dishes/tea.png';
import tiramisu from '../assets/dishes/tiramisu.png';
import cheesecake from '../assets/dishes/cheesecake.jpg';
import margarita from '../assets/dishes/margarita.png';
import peperoni from '../assets/dishes/peperoni.jpg';

export const categories = [
  { id: 'soups',    name: 'Супи',     name_en: 'Soups',     count: 3, image: soup },
  { id: 'mains',    name: 'Основні',  name_en: 'Mains',     count: 8, image: main },
  { id: 'salads',   name: 'Салати',   name_en: 'Salads',    count: 2, image: salad },
  { id: 'drinks',   name: 'Напої',    name_en: 'Drinks',    count: 2, image: drinks },
  { id: 'desserts', name: 'Десерти',  name_en: 'Desserts',  count: 2, image: desserts },
  { id: 'pizza',    name: 'Піца',     name_en: 'Pizza',     count: 2, image: pizza },
];

export const dishes = {
  mains: [
    {
      id: 1,
      name: 'Деруни з м\'ясом',
      name_en: 'Potato pancakes with meat',
      price: 190,
      rating: 4.8,
      reviewCount: 12,
      image: deruni,
      description: 'Традиційні хрусткі картопляні млинці з соковитою м\'ясною начинкою зі свинини та яловичини. Подаються гарячими з домашньою сметаною та свіжою зеленню на ваш вибір.',
      description_en: 'Traditional crispy potato pancakes filled with juicy pork and beef stuffing. Served hot with homemade sour cream and fresh herbs of your choice.',
      ingredients: 'Картопля, свинина, яловичина, цибуля, борошно пшеничне, яйце, соняшникова олія, сіль, чорний перець, сметана',
      ingredients_en: 'Potato, pork, beef, onion, wheat flour, egg, sunflower oil, salt, black pepper, sour cream',
      reviews: [
        { author: 'Олена', rating: 5, text: 'Дуже ситно і смачно! М\'яса багато, скоринка ідеально хрустка.', text_en: 'Very filling and delicious! Lots of meat, the crust is perfectly crispy.' },
        { author: 'Ігор',  rating: 4, text: 'Смачні, але трохи жирнуваті як на мене.', text_en: 'Tasty, but a bit greasy for my taste.' },
      ],
    },
    {
      id: 2,
      name: 'Спагетті',
      name_en: 'Spaghetti',
      price: 120,
      rating: 4.5,
      reviewCount: 8,
      image: spagetti,
      description: 'Класична паста з томатним соусом та базиліком.',
      description_en: 'Classic pasta with tomato sauce and fresh basil.',
      ingredients: 'Спагетті, томати, базилік, часник, оливкова олія',
      ingredients_en: 'Spaghetti, tomatoes, basil, garlic, olive oil',
      reviews: [
        { author: 'Марина', rating: 5, text: 'Соус просто топ, дуже ароматний!', text_en: 'The sauce is amazing, very aromatic!' },
      ],
    },
    {
      id: 3,
      name: 'Котлета по-київськи',
      name_en: 'Chicken Kyiv',
      price: 150,
      rating: 4.9,
      reviewCount: 24,
      image: kotleta,
      description: 'Ніжне куряче філе з вершковим маслом та зеленню всередині.',
      description_en: 'Tender chicken fillet stuffed with butter and fresh herbs inside.',
      ingredients: 'Куряче філе, вершкове масло, петрушка, яйце, панірувальні сухарі',
      ingredients_en: 'Chicken fillet, butter, parsley, egg, breadcrumbs',
      reviews: [
        { author: 'Андрій',   rating: 5, text: 'Соковита всередині, масло витікає як треба 😍', text_en: 'Juicy inside, the butter flows out just right 😍' },
        { author: 'Світлана', rating: 5, text: 'Одна з найкращих, що я їла.', text_en: 'One of the best I have ever had.' },
      ],
    },
    {
      id: 4,
      name: 'Шніцель',
      name_en: 'Schnitzel',
      price: 200,
      rating: 5.0,
      reviewCount: 17,
      image: shnitzel,
      description: 'Відбивна з свинини у хрусткій паніровці.',
      description_en: 'Pork cutlet in a crispy breading.',
      ingredients: 'Свинина, яйце, борошно, панірувальні сухарі, олія',
      ingredients_en: 'Pork, egg, flour, breadcrumbs, oil',
      reviews: [
        { author: 'Олег', rating: 5, text: 'Ідеальна хрустка скоринка, м\'ясо ніжне.', text_en: 'Perfect crispy crust, the meat is tender.' },
      ],
    },
    {
      id: 5,
      name: 'Картопляне пюре',
      name_en: 'Mashed potatoes',
      price: 140,
      rating: 4.8,
      reviewCount: 9,
      image: mPotato,
      description: 'Ніжне картопляне пюре з вершковим маслом.',
      description_en: 'Smooth mashed potatoes with butter.',
      ingredients: 'Картопля, вершкове масло, молоко, сіль',
      ingredients_en: 'Potato, butter, milk, salt',
      reviews: [
        { author: 'Ірина', rating: 5, text: 'Дуже ніжне, як домашнє.', text_en: 'Very smooth, just like homemade.' },
        { author: 'Петро', rating: 4, text: 'Смачно, але хотілось би більше масла.', text_en: 'Tasty, but I would like more butter.' },
      ],
    },
    {
      id: 6,
      name: 'Вареники з картоплею',
      name_en: 'Potato dumplings',
      price: 189,
      rating: 4.8,
      reviewCount: 15,
      image: vareniki,
      description: 'Домашні вареники з ніжним картопляним пюре.',
      description_en: 'Homemade dumplings filled with smooth mashed potatoes.',
      ingredients: 'Борошно, яйця, картопля, цибуля, вершкове масло',
      ingredients_en: 'Flour, eggs, potato, onion, butter',
      reviews: [
        { author: 'Наталя', rating: 5, text: 'Як у бабусі! Дуже смачно.', text_en: 'Just like grandma used to make! Delicious.' },
        { author: 'Денис',  rating: 4, text: 'Начинки достатньо, тісто хороше.', text_en: 'Good amount of filling, dough is great.' },
      ],
    },
    {
      id: 7,
      name: 'Гречка з маслом',
      name_en: 'Buckwheat with butter',
      price: 110,
      rating: 4.6,
      reviewCount: 7,
      image: grechka,
      description: 'Смачна розсипчаста гречка з вершковим маслом.',
      description_en: 'Tasty fluffy buckwheat served with butter.',
      ingredients: 'Гречка, вершкове масло, сіль',
      ingredients_en: 'Buckwheat, butter, salt',
      reviews: [
        { author: 'Віктор', rating: 4, text: 'Просто і смачно, без зайвого.', text_en: 'Simple and tasty, nothing unnecessary.' },
      ],
    },
    {
      id: 8,
      name: 'Плов',
      name_en: 'Plov',
      price: 160,
      rating: 4.7,
      reviewCount: 11,
      image: plov,
      description: 'Ароматний плов з рисом, м\'ясом та спеціями.',
      description_en: 'Aromatic plov with rice, meat and spices.',
      ingredients: 'Рис, м\'ясо (свинина або курка), морква, цибуля, часник, спеції',
      ingredients_en: 'Rice, meat (pork or chicken), carrot, onion, garlic, spices',
      reviews: [
        { author: 'Аліна',  rating: 5, text: 'Дуже ароматний, спеції супер.', text_en: 'Very aromatic, the spices are great.' },
        { author: 'Руслан', rating: 4, text: 'Смачний, але хотілось би більше м\'яса.', text_en: 'Tasty, but I would like more meat.' },
      ],
    },
  ],

  soups: [
    {
      id: 9,
      name: 'Борщ',
      name_en: 'Borscht',
      price: 89,
      rating: 4.9,
      reviewCount: 31,
      image: borsh,
      description: 'Традиційний український борщ.',
      description_en: 'Traditional Ukrainian borscht.',
      ingredients: 'Буряк, капуста, морква, картопля, м\'ясо, томатна паста',
      ingredients_en: 'Beetroot, cabbage, carrot, potato, meat, tomato paste',
      reviews: [
        { author: 'Ганна',  rating: 5, text: 'Справжній український борщ ❤️', text_en: 'Real Ukrainian borscht ❤️' },
        { author: 'Сергій', rating: 5, text: 'Зі сметаною — просто ідеально.', text_en: 'With sour cream — absolutely perfect.' },
      ],
    },
    {
      id: 10,
      name: 'Юшка',
      name_en: 'Fish soup',
      price: 75,
      rating: 4.6,
      reviewCount: 5,
      image: soup,
      description: 'Рибна юшка зі свіжої риби.',
      description_en: 'Light fish soup made from fresh fish.',
      ingredients: 'Риба, картопля, морква, цибуля, зелень',
      ingredients_en: 'Fish, potato, carrot, onion, herbs',
      reviews: [
        { author: 'Микола', rating: 4, text: 'Легка і смачна, як на природі.', text_en: 'Light and tasty, feels like being outdoors.' },
      ],
    },
    {
      id: 11,
      name: 'Грибний суп',
      name_en: 'Mushroom soup',
      price: 70,
      rating: 4.4,
      reviewCount: 7,
      image: mushroom,
      description: 'Ароматний суп з лісових грибів.',
      description_en: 'Aromatic soup made from forest mushrooms.',
      ingredients: 'Гриби, картопля, цибуля, сметана, зелень',
      ingredients_en: 'Mushrooms, potato, onion, sour cream, herbs',
      reviews: [
        { author: 'Оксана', rating: 5, text: 'Дуже ароматний, гриби відчуваються добре.', text_en: 'Very aromatic, you can really taste the mushrooms.' },
        { author: 'Ілля',   rating: 4, text: 'Смачний, але трохи густий.', text_en: 'Tasty, but a bit thick.' },
      ],
    },
  ],

  salads: [
    {
      id: 12,
      name: 'Цезар',
      name_en: 'Caesar',
      price: 135,
      rating: 4.7,
      reviewCount: 19,
      image: chezar,
      description: 'Класичний салат Цезар з курячим філе.',
      description_en: 'Classic Caesar salad with chicken fillet.',
      ingredients: 'Курка, салат ромен, пармезан, сухарики, соус цезар',
      ingredients_en: 'Chicken, romaine lettuce, parmesan, croutons, Caesar dressing',
      reviews: [
        { author: 'Марія', rating: 5, text: 'Соус просто бомба!', text_en: 'The dressing is absolutely amazing!' },
      ],
    },
    {
      id: 13,
      name: 'Грецький',
      name_en: 'Greek salad',
      price: 110,
      rating: 4.5,
      reviewCount: 11,
      image: greek,
      description: 'Свіжий грецький салат з фетою.',
      description_en: 'Fresh Greek salad with feta cheese.',
      ingredients: 'Огірки, помідори, оливки, фета, цибуля, оливкова олія',
      ingredients_en: 'Cucumber, tomatoes, olives, feta cheese, onion, olive oil',
      reviews: [
        { author: 'Юля', rating: 4, text: 'Свіжий і легкий салат.', text_en: 'Fresh and light salad.' },
      ],
    },
  ],

  drinks: [
    {
      id: 14,
      name: 'Лимонад',
      name_en: 'Lemonade',
      price: 55,
      rating: 4.8,
      reviewCount: 22,
      image: lemonade,
      description: 'Свіжий домашній лимонад.',
      description_en: 'Fresh homemade lemonade.',
      ingredients: 'Лимон, цукор, вода, м\'ята',
      ingredients_en: 'Lemon, sugar, water, mint',
      reviews: [
        { author: 'Артем', rating: 5, text: 'Дуже освіжає!', text_en: 'Very refreshing!' },
        { author: 'Оля',   rating: 5, text: 'Ідеально в спеку.', text_en: 'Perfect in the heat.' },
      ],
    },
    {
      id: 15,
      name: 'Чай',
      name_en: 'Tea',
      price: 35,
      rating: 4.6,
      reviewCount: 14,
      image: tea,
      description: 'Ароматний чай на вибір.',
      description_en: 'Aromatic tea of your choice.',
      ingredients: 'Чайний лист, вода',
      ingredients_en: 'Tea leaves, water',
      reviews: [
        { author: 'Ігор', rating: 4, text: 'Звичайний, але хороший чай.', text_en: 'Plain but good tea.' },
      ],
    },
  ],

  desserts: [
    {
      id: 16,
      name: 'Тірамісу',
      name_en: 'Tiramisu',
      price: 145,
      rating: 4.9,
      reviewCount: 28,
      image: tiramisu,
      description: 'Класичний італійський десерт.',
      description_en: 'Classic Italian dessert.',
      ingredients: 'Маскарпоне, кава, савоярді, яйця, цукор, какао',
      ingredients_en: 'Mascarpone, coffee, ladyfingers, eggs, sugar, cocoa',
      reviews: [
        { author: 'Катя', rating: 5, text: 'Ніжний і дуже смачний!', text_en: 'Delicate and absolutely delicious!' },
      ],
    },
    {
      id: 17,
      name: 'Чізкейк',
      name_en: 'Cheesecake',
      price: 120,
      rating: 4.7,
      reviewCount: 16,
      image: cheesecake,
      description: 'Ніжний чізкейк з ягідним соусом.',
      description_en: 'Smooth cheesecake with berry sauce.',
      ingredients: 'Вершковий сир, яйця, цукор, пісочна основа',
      ingredients_en: 'Cream cheese, eggs, sugar, shortcrust base',
      reviews: [
        { author: 'Влад',  rating: 5, text: 'Ідеальна текстура.', text_en: 'Perfect texture.' },
        { author: 'Софія', rating: 4, text: 'Трохи солодкий, але смачний.', text_en: 'A bit sweet, but tasty.' },
      ],
    },
  ],

  pizza: [
    {
      id: 18,
      name: 'Маргарита',
      name_en: 'Margherita',
      price: 195,
      rating: 4.8,
      reviewCount: 33,
      image: margarita,
      description: 'Класична піца з томатами та моцарелою.',
      description_en: 'Classic pizza with tomatoes and mozzarella.',
      ingredients: 'Тісто, томатний соус, моцарела, базилік',
      ingredients_en: 'Dough, tomato sauce, mozzarella, basil',
      reviews: [
        { author: 'Макс', rating: 5, text: 'Класика, завжди топ.', text_en: 'A classic, always great.' },
      ],
    },
    {
      id: 19,
      name: 'Пепероні',
      name_en: 'Pepperoni',
      price: 220,
      rating: 4.9,
      reviewCount: 41,
      image: peperoni,
      description: 'Гостра піца з пепероні.',
      description_en: 'Spicy pizza with pepperoni.',
      ingredients: 'Тісто, томатний соус, моцарела, пепероні',
      ingredients_en: 'Dough, tomato sauce, mozzarella, pepperoni',
      reviews: [
        { author: 'Дмитро', rating: 5, text: 'Гостренька як треба 🔥', text_en: 'Spicy just right 🔥' },
        { author: 'Аня',    rating: 5, text: 'Моя улюблена піца.', text_en: 'My favourite pizza.' },
      ],
    },
  ],
};

export const orderHistory = [
  { 
    id: 'WL-042', 
    date: '2026-03-30T18:03:00.000Z', 
    total: 710, 
    status: 'waiting', 
    items: [
      { id: 1, name: 'Деруни з м\'ясом', name_en: 'Potato pancakes with meat', status: 'waiting' },
      { id: 2, name: 'Шніцель (×2)', name_en: 'Schnitzel (×2)', status: 'cooking' },
      { id: 3, name: 'Спагетті', name_en: 'Spaghetti', status: 'ready' },
    ]
  },
  { 
    id: 'WL-041', 
    date: '2026-03-30T16:35:00.000Z', 
    total: 540, 
    status: 'served', 
    items: [
      { id: 4, name: 'Борщ український', name_en: 'Ukrainian Borsch', status: 'served' },
      { id: 5, name: 'Котлета по-київськи', name_en: 'Chicken Kyiv', status: 'served' },
    ]
  },
  { 
    id: 'WL-036', 
    date: '2026-03-29T12:08:00.000Z', 
    total: 290, 
    status: 'served', 
    items: [
      { id: 6, name: 'Сирники', name_en: 'Cottage cheese pancakes', status: 'served' },
      { id: 7, name: 'Капучино', name_en: 'Cappuccino', status: 'served' },
    ]
  },
];

export function getDishById(id) {
  const numId = parseInt(id);
  for (const cat of Object.values(dishes)) {
    const found = cat.find(d => d.id === numId);
    if (found) return found;
  }
  return null;
}

export function getDishesByCategory(categoryId) {
  return dishes[categoryId] || [];
}

export function getCategoryById(id) {
  return categories.find(c => c.id === id);
}