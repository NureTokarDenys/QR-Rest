import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import uaMenu from './locales/ua/client/menu.json';
import uaCategory from './locales/ua/client/category.json';
import uaFooter from './locales/ua/client/footer.json';
import uaClientToast from './locales/ua/client/clientToast.json'; 
import uaLogin from './locales/ua/client/login.json';
import uaNotFound from './locales/ua/client/notFound.json';
import uaDishDetails from './locales/ua/client/dishDetails.json';
import uaCart from './locales/ua/client/cart.json';
import uaProfile from './locales/ua/client/profile.json';
import uaOrderConfirmation from './locales/ua/client/orderConfirmation.json';
import uaOrderStatus from './locales/ua/client/orderStatus.json';
import uaMyOrders from './locales/ua/client/myOrders.json';

import enMenu from './locales/en/client/menu.json';
import enCategory from './locales/en/client/category.json';
import enFooter from './locales/en/client/footer.json';
import enClientToast from './locales/en/client/clientToast.json';
import enLogin from './locales/en/client/login.json';
import enNotFound from './locales/en/client/notFound.json';
import enDishDetails from './locales/en/client/dishDetails.json';
import enCart from './locales/en/client/cart.json';
import enProfile from './locales/en/client/profile.json';
import enOrderConfirmation from './locales/en/client/orderConfirmation.json';
import enOrderStatus from './locales/en/client/orderStatus.json';
import enMyOrders from './locales/en/client/myOrders.json';

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