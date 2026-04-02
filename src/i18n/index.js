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

import uaTableMap from './locales/ua/staff/tableMap.json';
import uaTableDetail from './locales/ua/staff/tableDetails.json';
import uaCooking from './locales/ua/staff/cooking.json';
import uaOrderDetail from './locales/ua/staff/orderDetail.json';
import uaMenuManagement from './locales/ua/staff/menuManagement.json';
import uaDishEdit from './locales/ua/staff/dishEdit.json';
import uaPdfGenerator from './locales/ua/staff/pdfGenerator.json';
import uaAnalytics from './locales/ua/staff/analytics.json';
import uaStaffSettings from './locales/ua/staff/staffSettings.json';
import uaComponents from './locales/ua/staff/components.json';

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

import enTableMap from './locales/en/staff/tableMap.json';
import enTableDetail from './locales/en/staff/tableDetails.json';
import enCooking from './locales/en/staff/cooking.json';
import enOrderDetail from './locales/en/staff/orderDetail.json';
import enMenuManagement from './locales/en/staff/menuManagement.json';
import enDishEdit from './locales/en/staff/dishEdit.json';
import enPdfGenerator from './locales/en/staff/pdfGenerator.json';
import enAnalytics from './locales/en/staff/analytics.json';
import enStaffSettings from './locales/en/staff/staffSettings.json';
import enComponents from './locales/en/staff/components.json';

i18n.use(initReactI18next).init({
  resources: {
    ua: {
      menu: uaMenu, category: uaCategory, footer: uaFooter,
      clientToast: uaClientToast, login: uaLogin, notFound: uaNotFound,
      dishDetails: uaDishDetails, cart: uaCart, profile: uaProfile,
      orderConfirmation: uaOrderConfirmation, orderStatus: uaOrderStatus,
      myOrders: uaMyOrders,
      tableMap: uaTableMap, tableDetail: uaTableDetail, cooking: uaCooking,
      orderDetail: uaOrderDetail, menuManagement: uaMenuManagement,
      dishEdit: uaDishEdit, pdfGenerator: uaPdfGenerator,
      analytics: uaAnalytics, staffSettings: uaStaffSettings,
      components: uaComponents,
    },
    en: {
      menu: enMenu, category: enCategory, footer: enFooter,
      clientToast: enClientToast, login: enLogin, notFound: enNotFound,
      dishDetails: enDishDetails, cart: enCart, profile: enProfile,
      orderConfirmation: enOrderConfirmation, orderStatus: enOrderStatus,
      myOrders: enMyOrders,
      tableMap: enTableMap, tableDetail: enTableDetail, cooking: enCooking,
      orderDetail: enOrderDetail, menuManagement: enMenuManagement,
      dishEdit: enDishEdit, pdfGenerator: enPdfGenerator,
      analytics: enAnalytics, staffSettings: enStaffSettings,
      components: enComponents,
    },
  },
  lng: localStorage.getItem('lang') ?? 'ua',
  fallbackLng: 'ua',
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => localStorage.setItem('lang', lng));

export default i18n;