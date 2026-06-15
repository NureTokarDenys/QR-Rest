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
      ingredientsList: [
        { id: 'i1-1', name: 'Картопля',            name_en: 'Potato',           isRemovable: false },
        { id: 'i1-2', name: 'Свинина',             name_en: 'Pork',             isRemovable: false },
        { id: 'i1-3', name: 'Цибуля',              name_en: 'Onion',            isRemovable: true  },
        { id: 'i1-4', name: 'Яйце',                name_en: 'Egg',              isRemovable: false },
        { id: 'i1-5', name: 'Сметана',             name_en: 'Sour cream',       isRemovable: true  },
        { id: 'i1-6', name: 'Чорний перець',       name_en: 'Black pepper',     isRemovable: true  },
      ],
      addons: [
        { id: 'a1-1', name: 'Додаткова сметана',   name_en: 'Extra sour cream', price: 15 },
        { id: 'a1-2', name: 'Свіжа зелень',        name_en: 'Fresh herbs',      price: 10 },
        { id: 'a1-3', name: 'Часниковий соус',     name_en: 'Garlic sauce',     price: 20 },
      ],
      componentGroups: [
        {
          id: 'cg1-1', name: 'Порція', name_en: 'Portion', isRequired: true,
          options: [
            { id: 'cgo1-1', name: '3 шт',  name_en: '3 pcs',  priceModifier: 0   },
            { id: 'cgo1-2', name: '5 шт',  name_en: '5 pcs',  priceModifier: 60  },
          ],
        },
      ],
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
      ingredientsList: [
        { id: 'i2-1', name: 'Спагетті',          name_en: 'Spaghetti',      isRemovable: false },
        { id: 'i2-2', name: 'Томати',             name_en: 'Tomatoes',       isRemovable: false },
        { id: 'i2-3', name: 'Базилік',            name_en: 'Basil',          isRemovable: true  },
        { id: 'i2-4', name: 'Часник',             name_en: 'Garlic',         isRemovable: true  },
        { id: 'i2-5', name: 'Оливкова олія',      name_en: 'Olive oil',      isRemovable: false },
      ],
      addons: [
        { id: 'a2-1', name: 'Пармезан',           name_en: 'Parmesan',       price: 25 },
        { id: 'a2-2', name: 'М\'ясні кульки',     name_en: 'Meatballs',      price: 45 },
      ],
      componentGroups: [],
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
      ingredientsList: [
        { id: 'i3-1', name: 'Куряче філе',        name_en: 'Chicken fillet',  isRemovable: false },
        { id: 'i3-2', name: 'Вершкове масло',     name_en: 'Butter',          isRemovable: false },
        { id: 'i3-3', name: 'Петрушка',           name_en: 'Parsley',         isRemovable: true  },
        { id: 'i3-4', name: 'Панірувальні сухарі',name_en: 'Breadcrumbs',     isRemovable: false },
      ],
      addons: [
        { id: 'a3-1', name: 'Картопляне пюре',    name_en: 'Mashed potatoes', price: 55 },
        { id: 'a3-2', name: 'Овочі гриль',        name_en: 'Grilled veggies', price: 40 },
        { id: 'a3-3', name: 'Соус тартар',        name_en: 'Tartar sauce',    price: 15 },
      ],
      componentGroups: [
        {
          id: 'cg3-1', name: 'Гарнір', name_en: 'Side dish', isRequired: true,
          options: [
            { id: 'cgo3-1', name: 'Картопля фрі',   name_en: 'French fries',     priceModifier: 0  },
            { id: 'cgo3-2', name: 'Рис',            name_en: 'Rice',             priceModifier: 0  },
            { id: 'cgo3-3', name: 'Гречка',         name_en: 'Buckwheat',        priceModifier: 0  },
          ],
        },
      ],
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
      ingredientsList: [
        { id: 'i4-1', name: 'Свинина',            name_en: 'Pork',             isRemovable: false },
        { id: 'i4-2', name: 'Яйце',               name_en: 'Egg',              isRemovable: false },
        { id: 'i4-3', name: 'Борошно',            name_en: 'Flour',            isRemovable: false },
        { id: 'i4-4', name: 'Панірувальні сухарі',name_en: 'Breadcrumbs',      isRemovable: false },
      ],
      addons: [
        { id: 'a4-1', name: 'Лимонний сік',       name_en: 'Lemon juice',      price: 0  },
        { id: 'a4-2', name: 'Брусничний соус',    name_en: 'Lingonberry sauce', price: 20 },
      ],
      componentGroups: [
        {
          id: 'cg4-1', name: 'Гарнір', name_en: 'Side dish', isRequired: true,
          options: [
            { id: 'cgo4-1', name: 'Картопля фрі',  name_en: 'French fries',    priceModifier: 0  },
            { id: 'cgo4-2', name: 'Салат',         name_en: 'Salad',           priceModifier: 0  },
          ],
        },
      ],
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
      ingredientsList: [
        { id: 'i5-1', name: 'Картопля',        name_en: 'Potato',   isRemovable: false },
        { id: 'i5-2', name: 'Вершкове масло',  name_en: 'Butter',   isRemovable: true  },
        { id: 'i5-3', name: 'Молоко',          name_en: 'Milk',     isRemovable: false },
        { id: 'i5-4', name: 'Сіль',            name_en: 'Salt',     isRemovable: true  },
      ],
      addons: [], componentGroups: [],
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
      ingredientsList: [
        { id: 'i6-1', name: 'Борошно',         name_en: 'Flour',   isRemovable: false },
        { id: 'i6-2', name: 'Картопля',        name_en: 'Potato',  isRemovable: false },
        { id: 'i6-3', name: 'Цибуля',          name_en: 'Onion',   isRemovable: true  },
        { id: 'i6-4', name: 'Вершкове масло',  name_en: 'Butter',  isRemovable: false },
      ],
      addons: [
        { id: 'a6-1', name: 'Сметана',   name_en: 'Sour cream', price: 15 },
        { id: 'a6-2', name: 'Шкварки',   name_en: 'Cracklings', price: 25 },
      ],
      componentGroups: [],
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
      ingredientsList: [
        { id: 'i7-1', name: 'Гречка',          name_en: 'Buckwheat', isRemovable: false },
        { id: 'i7-2', name: 'Вершкове масло',  name_en: 'Butter',    isRemovable: true  },
        { id: 'i7-3', name: 'Сіль',            name_en: 'Salt',      isRemovable: true  },
      ],
      addons: [], componentGroups: [],
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
      ingredientsList: [
        { id: 'i8-1', name: 'Рис',     name_en: 'Rice',    isRemovable: false },
        { id: 'i8-2', name: 'Морква',  name_en: 'Carrot',  isRemovable: true  },
        { id: 'i8-3', name: 'Цибуля',  name_en: 'Onion',   isRemovable: true  },
        { id: 'i8-4', name: 'Часник',  name_en: 'Garlic',  isRemovable: true  },
        { id: 'i8-5', name: 'Спеції',  name_en: 'Spices',  isRemovable: true  },
      ],
      addons: [], componentGroups: [],
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
      ingredientsList: [
        { id: 'i9-1', name: 'Буряк',        name_en: 'Beetroot',     isRemovable: false },
        { id: 'i9-2', name: 'Капуста',      name_en: 'Cabbage',      isRemovable: true  },
        { id: 'i9-3', name: 'Морква',       name_en: 'Carrot',       isRemovable: true  },
        { id: 'i9-4', name: 'Картопля',     name_en: 'Potato',       isRemovable: false },
        { id: 'i9-5', name: 'М\'ясо',       name_en: 'Meat',         isRemovable: false },
        { id: 'i9-6', name: 'Томатна паста',name_en: 'Tomato paste', isRemovable: true  },
      ],
      addons: [
        { id: 'a9-1', name: 'Сметана',   name_en: 'Sour cream',  price: 15 },
        { id: 'a9-2', name: 'Пампушка',  name_en: 'Bun',         price: 20 },
      ],
      componentGroups: [],
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
      ingredientsList: [
        { id: 'i10-1', name: 'Риба',      name_en: 'Fish',    isRemovable: false },
        { id: 'i10-2', name: 'Картопля',  name_en: 'Potato',  isRemovable: false },
        { id: 'i10-3', name: 'Морква',    name_en: 'Carrot',  isRemovable: true  },
        { id: 'i10-4', name: 'Цибуля',    name_en: 'Onion',   isRemovable: true  },
        { id: 'i10-5', name: 'Зелень',    name_en: 'Herbs',   isRemovable: true  },
      ],
      addons: [], componentGroups: [],
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
      ingredientsList: [
        { id: 'i11-1', name: 'Гриби',    name_en: 'Mushrooms', isRemovable: false },
        { id: 'i11-2', name: 'Картопля', name_en: 'Potato',    isRemovable: false },
        { id: 'i11-3', name: 'Цибуля',   name_en: 'Onion',     isRemovable: true  },
        { id: 'i11-4', name: 'Сметана',  name_en: 'Sour cream',isRemovable: true  },
        { id: 'i11-5', name: 'Зелень',   name_en: 'Herbs',     isRemovable: true  },
      ],
      addons: [], componentGroups: [],
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
      ingredientsList: [
        { id: 'i12-1', name: 'Курка',       name_en: 'Chicken',          isRemovable: false },
        { id: 'i12-2', name: 'Салат ромен', name_en: 'Romaine lettuce',  isRemovable: false },
        { id: 'i12-3', name: 'Пармезан',    name_en: 'Parmesan',         isRemovable: true  },
        { id: 'i12-4', name: 'Сухарики',    name_en: 'Croutons',         isRemovable: true  },
        { id: 'i12-5', name: 'Соус цезар',  name_en: 'Caesar dressing',  isRemovable: true  },
      ],
      addons: [
        { id: 'a12-1', name: 'Яйце пашот',  name_en: 'Poached egg',     price: 30 },
        { id: 'a12-2', name: 'Бекон',       name_en: 'Bacon',           price: 35 },
      ],
      componentGroups: [],
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
      ingredientsList: [
        { id: 'i13-1', name: 'Огірки',       name_en: 'Cucumber',   isRemovable: false },
        { id: 'i13-2', name: 'Помідори',     name_en: 'Tomatoes',   isRemovable: false },
        { id: 'i13-3', name: 'Оливки',       name_en: 'Olives',     isRemovable: true  },
        { id: 'i13-4', name: 'Фета',         name_en: 'Feta',       isRemovable: false },
        { id: 'i13-5', name: 'Цибуля',       name_en: 'Onion',      isRemovable: true  },
      ],
      addons: [], componentGroups: [],
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
      ingredientsList: [
        { id: 'i14-1', name: 'Лимон',  name_en: 'Lemon',  isRemovable: false },
        { id: 'i14-2', name: 'Цукор',  name_en: 'Sugar',  isRemovable: true  },
        { id: 'i14-3', name: 'М\'ята', name_en: 'Mint',   isRemovable: true  },
      ],
      addons: [
        { id: 'a14-1', name: 'Лід',     name_en: 'Ice',    price: 0 },
      ],
      componentGroups: [],
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
      ingredientsList: [
        { id: 'i15-1', name: 'Чайний лист', name_en: 'Tea leaves', isRemovable: false },
        { id: 'i15-2', name: 'Вода',        name_en: 'Water',      isRemovable: false },
      ],
      addons: [
        { id: 'a15-1', name: 'Лимон',  name_en: 'Lemon',  price: 0  },
        { id: 'a15-2', name: 'Мед',    name_en: 'Honey',  price: 10 },
      ],
      componentGroups: [],
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
      ingredientsList: [
        { id: 'i16-1', name: 'Маскарпоне', name_en: 'Mascarpone',   isRemovable: false },
        { id: 'i16-2', name: 'Кава',       name_en: 'Coffee',       isRemovable: false },
        { id: 'i16-3', name: 'Савоярді',   name_en: 'Ladyfingers',  isRemovable: false },
        { id: 'i16-4', name: 'Какао',      name_en: 'Cocoa',        isRemovable: true  },
      ],
      addons: [], componentGroups: [],
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
      ingredientsList: [
        { id: 'i17-1', name: 'Вершковий сир',  name_en: 'Cream cheese',    isRemovable: false },
        { id: 'i17-2', name: 'Яйця',           name_en: 'Eggs',            isRemovable: false },
        { id: 'i17-3', name: 'Пісочна основа', name_en: 'Shortcrust base', isRemovable: false },
        { id: 'i17-4', name: 'Ягідний соус',   name_en: 'Berry sauce',     isRemovable: true  },
      ],
      addons: [], componentGroups: [],
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
      ingredientsList: [
        { id: 'i18-1', name: 'Тісто',        name_en: 'Dough',         isRemovable: false },
        { id: 'i18-2', name: 'Томатний соус', name_en: 'Tomato sauce',  isRemovable: false },
        { id: 'i18-3', name: 'Моцарела',     name_en: 'Mozzarella',    isRemovable: false },
        { id: 'i18-4', name: 'Базилік',      name_en: 'Basil',         isRemovable: true  },
      ],
      addons: [
        { id: 'a18-1', name: 'Подвійна моцарела', name_en: 'Double mozzarella', price: 35 },
        { id: 'a18-2', name: 'Оливки',            name_en: 'Olives',            price: 20 },
      ],
      componentGroups: [
        {
          id: 'cg18-1', name: 'Розмір', name_en: 'Size', isRequired: true,
          options: [
            { id: 'cgo18-1', name: '30 см', name_en: '30 cm', priceModifier: 0  },
            { id: 'cgo18-2', name: '40 см', name_en: '40 cm', priceModifier: 60 },
          ],
        },
      ],
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
      ingredientsList: [
        { id: 'i19-1', name: 'Тісто',        name_en: 'Dough',         isRemovable: false },
        { id: 'i19-2', name: 'Томатний соус', name_en: 'Tomato sauce',  isRemovable: false },
        { id: 'i19-3', name: 'Моцарела',     name_en: 'Mozzarella',    isRemovable: false },
        { id: 'i19-4', name: 'Пепероні',     name_en: 'Pepperoni',     isRemovable: false },
      ],
      addons: [
        { id: 'a19-1', name: 'Гострий соус',        name_en: 'Hot sauce',          price: 0  },
        { id: 'a19-2', name: 'Подвійна моцарела',   name_en: 'Double mozzarella',  price: 35 },
      ],
      componentGroups: [
        {
          id: 'cg19-1', name: 'Розмір', name_en: 'Size', isRequired: true,
          options: [
            { id: 'cgo19-1', name: '30 см', name_en: '30 cm', priceModifier: 0  },
            { id: 'cgo19-2', name: '40 см', name_en: '40 cm', priceModifier: 80 },
          ],
        },
      ],
      reviews: [
        { author: 'Дмитро', rating: 5, text: 'Гостренька як треба 🔥', text_en: 'Spicy just right 🔥' },
        { author: 'Аня',    rating: 5, text: 'Моя улюблена піца.', text_en: 'My favourite pizza.' },
      ],
    },
  ],
};

export const orderHistory = [
  { 
    id: 'WL-041', 
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
    id: 'WL-040', 
    date: '2026-03-30T16:35:00.000Z', 
    total: 540, 
    status: 'served', 
    items: [
      { id: 4, name: 'Борщ український', name_en: 'Ukrainian Borsch', status: 'served' },
      { id: 5, name: 'Котлета по-київськи', name_en: 'Chicken Kyiv', status: 'served' },
    ]
  },
  { 
    id: 'WL-039', 
    date: '2026-03-29T12:08:00.000Z', 
    total: 290, 
    status: 'served', 
    items: [
      { id: 6, name: 'Сирники', name_en: 'Cottage cheese pancakes', status: 'served' },
      { id: 7, name: 'Капучино', name_en: 'Cappuccino', status: 'served' },
    ]
  },
];

export const TABLES = [
  { id: 1, seats: 4, status: 'free',    orderId: null,      dishes: [] },
  { id: 2, seats: 4, status: 'waiter',  orderId: 'WL-041',  timeAtTable: '00:47:12',
    dishes: [
      { name: 'Деруни з м\'ясом', name_en: 'Potato pancakes', qty: 1, price: 190, status: 'waiting' },
      { name: 'Котлета по-київськи', name_en: 'Chicken Kyiv', qty: 1, price: 150, status: 'waiting' },
      { name: 'Спагетті', name_en: 'Spaghetti', qty: 1, price: 120, status: 'waiting' },
    ]
  },
  { id: 3, seats: 6, status: 'free',    orderId: null,      dishes: [] },
  { id: 4, seats: 2, status: 'busy',    orderId: 'WL-040',  timeAtTable: '00:22:05',
    dishes: [
      { name: 'Картопляне пюре', name_en: 'Mashed potatoes', qty: 1, price: 140, status: 'served' },
      { name: 'Шніцель', name_en: 'Schnitzel', qty: 2, price: 400, status: 'served' },
      { name: 'Борщ', name_en: 'Borscht', qty: 1, price: 89, status: 'served' },
    ]
  },
  { id: 5, seats: 6, status: 'free',    orderId: null,      dishes: [] },
];

export const KANBAN_ITEMS = [
  { id: 'k1', dishName: 'Деруни з м\'ясом',     dishName_en: 'Potato pancakes', tableId: 1, orderId: 'WL-041', dishCount: 3, time: '14:20', status: 'waiting' },
  { id: 'k2', dishName: 'Котлета по-київськи',  dishName_en: 'Chicken Kyiv',    tableId: 1, orderId: 'WL-041', dishCount: 3, time: '14:22', status: 'waiting' },
  { id: 'k3', dishName: 'Спагетті',             dishName_en: 'Spaghetti',       tableId: 1, orderId: 'WL-041', dishCount: 3, time: '14:22', status: 'waiting' },
  { id: 'k4', dishName: 'Деруни з м\'ясом',     dishName_en: 'Potato pancakes', tableId: 2, orderId: 'WL-040', dishCount: 3, time: '14:22', status: 'waiting' },
  { id: 'k5', dishName: 'Шніцель (×2)',         dishName_en: 'Schnitzel (×2)',  tableId: 3, orderId: 'WL-040', dishCount: 3, time: '14:23', status: 'cooking' },
  { id: 'k6', dishName: 'Спагетті',             dishName_en: 'Spaghetti',       tableId: 3, orderId: 'WL-040', dishCount: 3, time: '14:23', status: 'ready' },
  { id: 'k7', dishName: 'Картопляне пюре',      dishName_en: 'Mashed potatoes', tableId: 3, orderId: 'WL-039', dishCount: 3, time: '14:10', status: 'served' },
  { id: 'k8', dishName: 'Шніцель (×2)',         dishName_en: 'Schnitzel (×2)',  tableId: 3, orderId: 'WL-039', dishCount: 3, time: '14:15', status: 'served' },
  { id: 'k9', dishName: 'Борщ',                 dishName_en: 'Borscht',         tableId: 3, orderId: 'WL-039', dishCount: 3, time: '14:18', status: 'served' },
];

export const ORDER_DETAIL = {
  id: 'WL-042',
  tableId: 2,
  time: '14:31',
  status: 'waiter',
  items: [
    { id: 1, name: 'Деруни з м\'ясом', name_en: 'Potato pancakes', qty: 1, price: 190, status: 'waiting' },
    { id: 2, name: 'Шніцель',          name_en: 'Schnitzel',        qty: 2, price: 400, status: 'cooking' },
    { id: 3, name: 'Спагетті',         name_en: 'Spaghetti',        qty: 1, price: 110, status: 'ready' },
  ],
  comment: null,
  total: 710,
};

export const NOTIFICATIONS = [
  { id: 'n1', type: 'waiter', tableId: 2, time: '14:30' },
  { id: 'n2', type: 'newOrder', tableId: 1, time: '14:28' },
];

export const SHIFT_STATS = {
  orders: 18,
  completed: 15,
  revenue: 7840,
  avgCheck: 436,
};

export const MENU_DISHES_FLAT = [
  { id: 1,  name: 'Борщ з пампушками',    name_en: 'Borscht with buns',  category: 'soups',    categoryName: 'Супи',    categoryName_en: 'Soups',    price: 189, available: true,  image: null },
  { id: 2,  name: 'Котлета по-київськи',  name_en: 'Chicken Kyiv',       category: 'mains',    categoryName: 'Основні', categoryName_en: 'Mains',    price: 245, available: true,  image: null },
  { id: 3,  name: 'Суші з лососем',       name_en: 'Salmon sushi',       category: 'soups',    categoryName: 'Суші',    categoryName_en: 'Sushi',    price: 320, available: false, image: null },
  { id: 4,  name: 'Чай з лимоном',        name_en: 'Lemon tea',          category: 'drinks',   categoryName: 'Напої',   categoryName_en: 'Drinks',   price: 55,  available: true,  image: null },
  { id: 5,  name: 'Яблучний штрудель',    name_en: 'Apple strudel',      category: 'desserts', categoryName: 'Десерти', categoryName_en: 'Desserts', price: 145, available: true,  image: null },
];

export const ANALYTICS_DATA = {
  revenue: 14820,
  revenueChange: 18,
  orders: 38,
  ordersChange: 12,
  avgCheck: 390,
  avgCheckChange: -5,
  completedOrders: 34,
  voidOrders: 4,
  walkoutCount: 2,
  walkoutChange: -1,
  conversionPct: 89,
  avgCookingMin: 14,
  avgCookingChange: -2,
  hourlyBars: [2, 3, 5, 8, 12, 15, 18, 14, 20, 16, 10, 8],
  hours: ['09','10','11','12','13','14','15','16','17','18','19','20'],
  topCategories: [
    { name: 'Основні', name_en: 'Mains',    pct: 38, color: '#1d7afc' },
    { name: 'Напої',   name_en: 'Drinks',   pct: 24, color: '#10b981' },
    { name: 'Закуски', name_en: 'Starters', pct: 18, color: '#f59e0b' },
    { name: 'Супи',    name_en: 'Soups',    pct: 12, color: '#ef4444' },
    { name: 'Інше',    name_en: 'Other',    pct: 8,  color: '#8e8e93' },
  ],
  topDishes: [
    { num: 1, name: 'Котлета по-київськи', name_en: 'Chicken Kyiv',    ordered: 24, revenue: 5808, rating: 4.9 },
    { num: 2, name: 'Борщ з пампушками',  name_en: 'Borscht with buns', ordered: 19, revenue: 3591, rating: 4.8 },
    { num: 3, name: 'Вареники',           name_en: 'Dumplings',        ordered: 15, revenue: 2325, rating: 4.7 },
  ],
};

export const STAFF_USER = {
  name: 'Микола Сидоренко',
  name_en: 'Mykola Sydorenko',
  email: 'mykola@waitless.app',
  role: 'waiter',
  initials: 'МС',
};

export const TABLE_HISTORY = [
  { id: 'WL-033', total: 799 },
  { id: 'WL-023', total: 512 },
  { id: 'WL-011', total: 345 },
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