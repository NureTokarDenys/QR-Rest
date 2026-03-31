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
  { id: 'soups', name: 'Супи', count: 3, image: soup },
  { id: 'mains', name: 'Основні', count: 8, image: main },
  { id: 'salads', name: 'Салати', count: 2, image: salad },
  { id: 'drinks', name: 'Напої', count: 2, image: drinks },
  { id: 'desserts', name: 'Десерти', count: 2, image: desserts },
  { id: 'pizza', name: 'Піца', count: 2, image: pizza },
];

export const dishes = {
 mains: [
  { id: 1, name: 'Деруни з м\'ясом', price: 190, rating: 4.8, reviewCount: 12, image: deruni, description: 'Традиційні хрусткі картопляні млинці з соковитою м\'ясною начинкою зі свинини та яловичини. Подаються гарячими з домашньою сметаною та свіжою зеленню на ваш вибір.', ingredients: 'Картопля, свинина, яловичина, цибуля, борошно пшеничне, яйце, соняшникова олія, сіль, чорний перець, сметана', reviews: [
    { author: 'Олена', rating: 5, text: 'Дуже ситно і смачно! М\'яса багато, скоринка ідеально хрустка.' },
    { author: 'Ігор', rating: 4, text: 'Смачні, але трохи жирнуваті як на мене.' }
  ] },
  { id: 2, name: 'Спагетті', price: 120, rating: 4.5, reviewCount: 8, image: spagetti, description: 'Класична паста з томатним соусом та базиліком.', ingredients: 'Спагетті, томати, базилік, часник, оливкова олія', reviews: [
    { author: 'Марина', rating: 5, text: 'Соус просто топ, дуже ароматний!' }
  ] },
  { id: 3, name: 'Котлета по-київськи', price: 150, rating: 4.9, reviewCount: 24, image: kotleta, description: 'Ніжне куряче філе з вершковим маслом та зеленню всередині.', ingredients: 'Куряче філе, вершкове масло, петрушка, яйце, панірувальні сухарі', reviews: [
    { author: 'Андрій', rating: 5, text: 'Соковита всередині, масло витікає як треба 😍' },
    { author: 'Світлана', rating: 5, text: 'Одна з найкращих, що я їла.' }
  ] },
  { id: 4, name: 'Шніцель', price: 200, rating: 5.0, reviewCount: 17, image: shnitzel, description: 'Відбивна з свинини у хрусткій паніровці.', ingredients: 'Свинина, яйце, борошно, панірувальні сухарі, олія', reviews: [
    { author: 'Олег', rating: 5, text: 'Ідеальна хрустка скоринка, м\'ясо ніжне.' }
  ] },
  { id: 5, name: 'Картопляне пюре', price: 140, rating: 4.8, reviewCount: 9, image: mPotato, description: 'Ніжне картопляне пюре з вершковим маслом.', ingredients: 'Картопля, вершкове масло, молоко, сіль', reviews: [
    { author: 'Ірина', rating: 5, text: 'Дуже ніжне, як домашнє.' },
    { author: 'Петро', rating: 4, text: 'Смачно, але хотілось би більше масла.' }
  ] },
  { id: 6, name: 'Вареники з картоплею', price: 189, rating: 4.8, reviewCount: 15, image: vareniki, description: 'Домашні вареники з ніжним картопляним пюре.', ingredients: 'Борошно, яйця, картопля, цибуля, вершкове масло', reviews: [
    { author: 'Наталя', rating: 5, text: 'Як у бабусі! Дуже смачно.' },
    { author: 'Денис', rating: 4, text: 'Начинки достатньо, тісто хороше.' }
  ] },
  { id: 7, name: 'Гречка з маслом', price: 110, rating: 4.6, reviewCount: 7, image: grechka, description: 'Смачна розсипчаста гречка з вершковим маслом.', ingredients: 'Гречка, вершкове масло, сіль', reviews: [
    { author: 'Віктор', rating: 4, text: 'Просто і смачно, без зайвого.' }
  ] },
  { id: 8, name: 'Плов', price: 160, rating: 4.7, reviewCount: 11, image: plov, description: 'Ароматний плов з рисом, м\'ясом та спеціями.', ingredients: 'Рис, м\'ясо (свинина або курка), морква, цибуля, часник, спеції', reviews: [
    { author: 'Аліна', rating: 5, text: 'Дуже ароматний, спеції супер.' },
    { author: 'Руслан', rating: 4, text: 'Смачний, але хотілось би більше м\'яса.' }
  ] }
  ],

  soups: [
  { id: 9, name: 'Борщ', price: 89, rating: 4.9, reviewCount: 31, image: borsh, description: 'Традиційний український борщ.', ingredients: 'Буряк, капуста, морква, картопля, м\'ясо, томатна паста', reviews: [
    { author: 'Ганна', rating: 5, text: 'Справжній український борщ ❤️' },
    { author: 'Сергій', rating: 5, text: 'Зі сметаною — просто ідеально.' }
  ] },
  { id: 10, name: 'Юшка', price: 75, rating: 4.6, reviewCount: 5, image: soup, description: 'Рибна юшка зі свіжої риби.', ingredients: 'Риба, картопля, морква, цибуля, зелень', reviews: [
    { author: 'Микола', rating: 4, text: 'Легка і смачна, як на природі.' }
  ] },
  { id: 11, name: 'Грибний суп', price: 70, rating: 4.4, reviewCount: 7, image: mushroom, description: 'Ароматний суп з лісових грибів.', ingredients: 'Гриби, картопля, цибуля, сметана, зелень', reviews: [
    { author: 'Оксана', rating: 5, text: 'Дуже ароматний, гриби відчуваються добре.' },
    { author: 'Ілля', rating: 4, text: 'Смачний, але трохи густий.' }
  ] }
  ],

  salads: [
  { id: 12, name: 'Цезар', price: 135, rating: 4.7, reviewCount: 19, image: chezar, description: 'Класичний салат Цезар з курячим філе.', ingredients: 'Курка, салат ромен, пармезан, сухарики, соус цезар', reviews: [
    { author: 'Марія', rating: 5, text: 'Соус просто бомба!' }
  ] },
  { id: 13, name: 'Грецький', price: 110, rating: 4.5, reviewCount: 11, image: greek, description: 'Свіжий грецький салат з фетою.', ingredients: 'Огірки, помідори, оливки, фета, цибуля, оливкова олія', reviews: [
    { author: 'Юля', rating: 4, text: 'Свіжий і легкий салат.' }
  ] }
  ],

  drinks: [
  { id: 14, name: 'Лимонад', price: 55, rating: 4.8, reviewCount: 22, image: lemonade, description: 'Свіжий домашній лимонад.', ingredients: 'Лимон, цукор, вода, м\'ята', reviews: [
    { author: 'Артем', rating: 5, text: 'Дуже освіжає!' },
    { author: 'Оля', rating: 5, text: 'Ідеально в спеку.' }
  ] },
  { id: 15, name: 'Чай', price: 35, rating: 4.6, reviewCount: 14, image: tea, description: 'Ароматний чай на вибір.', ingredients: 'Чайний лист, вода', reviews: [
    { author: 'Ігор', rating: 4, text: 'Звичайний, але хороший чай.' }
  ] }
  ],

  desserts: [
  { id: 16, name: 'Тірамісу', price: 145, rating: 4.9, reviewCount: 28, image: tiramisu, description: 'Класичний італійський десерт.', ingredients: 'Маскарпоне, кава, савоярді, яйця, цукор, какао', reviews: [
    { author: 'Катя', rating: 5, text: 'Ніжний і дуже смачний!' }
  ] },
  { id: 17, name: 'Чізкейк', price: 120, rating: 4.7, reviewCount: 16, image: cheesecake, description: 'Ніжний чізкейк з ягідним соусом.', ingredients: 'Вершковий сир, яйця, цукор, пісочна основа', reviews: [
    { author: 'Влад', rating: 5, text: 'Ідеальна текстура.' },
    { author: 'Софія', rating: 4, text: 'Трохи солодкий, але смачний.' }
  ] }
  ],

  pizza: [
  { id: 18, name: 'Маргарита', price: 195, rating: 4.8, reviewCount: 33, image: margarita, description: 'Класична піца з томатами та моцарелою.', ingredients: 'Тісто, томатний соус, моцарела, базилік', reviews: [
    { author: 'Макс', rating: 5, text: 'Класика, завжди топ.' }
  ] },
  { id: 19, name: 'Пепероні', price: 220, rating: 4.9, reviewCount: 41, image: peperoni, description: 'Гостра піца з пепероні.', ingredients: 'Тісто, томатний соус, моцарела, пепероні', reviews: [
    { author: 'Дмитро', rating: 5, text: 'Гостренька як треба 🔥' },
    { author: 'Аня', rating: 5, text: 'Моя улюблена піца.' }
  ] }
  ],
};

export const orderHistory = [
  { id: 'WL-042', date: '18:03 30 березня 2026', total: 710, status: 'cooking' },
  { id: 'WL-041', date: '16:35 30 березня 2026', total: 540, status: 'done' },
  { id: 'WL-036', date: '12:08 29 березня 2026', total: 290, status: 'done' },
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