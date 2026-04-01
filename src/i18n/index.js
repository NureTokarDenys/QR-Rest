import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import uaMenu from './locales/ua/menu.json';
import uaCategory from './locales/ua/category.json';
import uaFooter from './locales/ua/footer.json';
import uaClientToast from './locales/ua/clientToast.json'; 
import uaLogin from './locales/ua/login.json';
import uaNotFound from './locales/ua/notFound.json';
import uaDishDetails from './locales/ua/dishDetails.json';
import uaCart from './locales/ua/cart.json';
import uaProfile from './locales/ua/profile.json';
import uaOrderConfirmation from './locales/ua/orderConfirmation.json';
import uaOrderStatus from './locales/ua/orderStatus.json';
import uaMyOrders from './locales/ua/myOrders.json';

import enMenu from './locales/en/menu.json';
import enCategory from './locales/en/category.json';
import enFooter from './locales/en/footer.json';
import enClientToast from './locales/en/clientToast.json';
import enLogin from './locales/en/login.json';
import enNotFound from './locales/en/notFound.json';
import enDishDetails from './locales/en/dishDetails.json';
import enCart from './locales/en/cart.json';
import enProfile from './locales/en/profile.json';
import enOrderConfirmation from './locales/en/orderConfirmation.json';
import enOrderStatus from './locales/en/orderStatus.json';
import enMyOrders from './locales/en/myOrders.json';

i18n.use(initReactI18next).init({
  resources: {
    ua: { menu: uaMenu, 
        category: uaCategory, 
        footer: uaFooter, 
        clientToast: uaClientToast, 
        login: uaLogin, 
        notFound: uaNotFound, 
        dishDetails: uaDishDetails, 
        cart: uaCart, 
        profile: uaProfile, 
        orderConfirmation: uaOrderConfirmation, 
        orderStatus: uaOrderStatus,
        myOrders: uaMyOrders },
    en: { menu: enMenu, 
        category: enCategory, 
        footer: enFooter, 
        clientToast: enClientToast, 
        login: enLogin, 
        notFound: enNotFound, 
        dishDetails: enDishDetails, 
        cart: enCart, 
        profile: enProfile, 
        orderConfirmation: enOrderConfirmation, 
        orderStatus: enOrderStatus,
        myOrders: enMyOrders },
  },
  lng: localStorage.getItem('lang') ?? 'ua',
  fallbackLng: 'ua',
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => localStorage.setItem('lang', lng));

export default i18n;