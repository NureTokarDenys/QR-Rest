import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'; // Navigate used by /staff redirect
import { AppProvider, useApp } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import { PlanProvider } from './context/PlanContext';
import { MenuProvider } from './context/MenuContext';
import { ThemeProvider } from './context/ThemeContext';
import { ClientToastProvider } from "./context/ClientToastContext";
import { StaffNotificationsProvider } from './context/StaffNotificationsContext';
import { StaffDataProvider } from './context/StaffDataContext';
import ProtectedRoute, { ClientOnlyRoute } from './components/ProtectedRoute';
import RequirePlan from './components/RequirePlan';
import HttpErrorToast from './components/HttpErrorToast';
import NotificationToast from './components/client/NotificationToast';
import OfflineBanner from './components/client/OfflineBanner';
import DevToolbar from './components/DevToolbar';
import Login from './pages/Login';
import ForgotPassword from './pages/client/ForgotPassword';
import Register from './pages/client/Register';
import ConfirmEmailChange from './pages/client/ConfirmEmailChange';
import RestaurantPicker from './pages/client/RestaurantPicker';
import QrLanding from './pages/client/QrLanding';
import Forbidden from './pages/Forbidden';
import OAuthCallback from './pages/OAuthCallback';
import Menu from './pages/client/Menu';
import Category from './pages/client/Category';
import DishDetail from './pages/client/DishDetail';
import Cart from './pages/client/Cart';
import ConfirmOrder from './pages/client/ConfirmOrder';
import OrderStatus from './pages/client/OrderStatus';
import Profile from './pages/client/Profile';
import OrderHistory from './pages/client/OrderHistory';
import RestaurantReviews from './pages/client/RestaurantReviews';
import TableMap from './pages/staff/TableMap';
import TableDetail from './pages/staff/TableDetail';
import WaiterOrders from './pages/staff/WaiterOrders';
import Cooking from './pages/staff/Cooking';
import OrderDetail from './pages/staff/OrderDetail';
import MenuManagement from './pages/staff/MenuManagement';
import CategoryEdit from './pages/staff/CategoryEdit';
import DishEdit from './pages/staff/DishEdit';
import ExtrasManagement from './pages/staff/ExtrasManagement';
import ExtrasEdit from './pages/staff/ExtrasEdit';
import PdfGenerator from './pages/staff/PdfGenerator';
import Analytics from './pages/staff/Analytics';
import StaffSettings from './pages/staff/StaffSettings';
import RestaurantSettings from './pages/staff/RestaurantSettings';
import StaffManagement from './pages/staff/StaffManagement';
import ReviewsManagement from './pages/staff/ReviewsManagement';
import LandingPage   from './pages/onboarding/Landing';
import OnboardingPage from './pages/onboarding/Onboarding';
import CheckEmailPage from './pages/onboarding/CheckEmail';
import ConfirmPage    from './pages/onboarding/Confirm';

// Helper to wrap a page with ProtectedRoute
function Guard({ roles, children }) {
  return <ProtectedRoute requiredRoles={roles}>{children}</ProtectedRoute>;
}

// Smart root redirect:
//   • Waits for the async order-restore to finish so a freshly-logged-in client
//     whose restaurant is resolved from their active order is sent to /menu
//     instead of /restaurants.
//   • session token present   → /menu  (QR-scan flow, restaurant auto-resolved)
//   • restaurantId in storage → /menu  (restaurant-picker flow or restored order)
//   • nothing                 → /restaurants  (let client pick a restaurant)
function RootRedirect() {
  const { restoringOrder, restaurantId: ctxRestaurantId } = useApp();
  if (restoringOrder) return null; // wait for restore before deciding
  const hasSession    = !!localStorage.getItem('sessionToken');
  const hasRestaurant = !!localStorage.getItem('restaurantId') || !!ctxRestaurantId;
  return <Navigate to={hasSession || hasRestaurant ? '/menu' : '/restaurants'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
    <AppProvider>
    <StaffDataProvider>
    <PlanProvider>
    <MenuProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ThemeProvider>
          <ClientToastProvider>
            <StaffNotificationsProvider>
            {/* Global HTTP error overlay — catches all unhandled 4xx / 5xx */}
            <HttpErrorToast />
            {/* Persistent notification banner for guest order events */}
            <NotificationToast />
            {/* Offline / reconnect status pill — visible only when needed */}
            <OfflineBanner />
            {/* Dev-only floating toolbar — stripped from production builds */}
            <DevToolbar />
            <Routes>
              {/* Smart root redirect */}
              <Route path="/" element={<RootRedirect />} />

              {/* Landing / marketing page */}
              <Route path="/landing" element={<LandingPage />} />

              {/* Onboarding — restaurant owner registration flow */}
              <Route path="/onboarding"             element={<OnboardingPage />} />
              <Route path="/onboarding/check-email" element={<CheckEmailPage />} />
              <Route path="/onboarding/confirm"     element={<ConfirmPage />} />

              <Route path="/login"           element={<Login />} />
              <Route path="/forgot-password"       element={<ForgotPassword />} />
              <Route path="/register"              element={<Register />} />
              <Route path="/confirm-email-change"  element={<ConfirmEmailChange />} />
              <Route path="/auth/callback" element={<OAuthCallback />} />
              <Route path="/forbidden" element={<Forbidden />} />

              {/* QR scan landing — calls initSession then redirects to /menu */}
              <Route path="/qr/:shortCode" element={<QrLanding />} />

              {/* Restaurant picker — direct access without QR scan */}
              <Route path="/restaurants" element={<RestaurantPicker />} />

              {/* Client routes — blocked for staff */}
              <Route path="/menu"             element={<ClientOnlyRoute><Menu /></ClientOnlyRoute>} />
              <Route path="/category/:id"     element={<ClientOnlyRoute><Category /></ClientOnlyRoute>} />
              <Route path="/dish/:id"         element={<ClientOnlyRoute><DishDetail /></ClientOnlyRoute>} />
              <Route path="/cart"             element={<ClientOnlyRoute><Cart /></ClientOnlyRoute>} />
              <Route path="/confirm"          element={<ClientOnlyRoute><ConfirmOrder /></ClientOnlyRoute>} />
              <Route path="/order-status"     element={<ClientOnlyRoute><OrderStatus /></ClientOnlyRoute>} />
              <Route path="/order-status/:orderId" element={<ClientOnlyRoute><OrderStatus /></ClientOnlyRoute>} />
              <Route path="/profile"          element={<ClientOnlyRoute><Profile /></ClientOnlyRoute>} />
              <Route path="/order-history"    element={<ClientOnlyRoute><OrderHistory /></ClientOnlyRoute>} />
              <Route path="/restaurant-reviews" element={<ClientOnlyRoute><RestaurantReviews /></ClientOnlyRoute>} />

              {/* Staff routes — role-gated */}
              <Route path="/staff" element={<Navigate to="/staff/map" replace />} />

              <Route path="/staff/map" element={
                <Guard roles={['admin', 'waiter', 'waiter_cook']}><TableMap /></Guard>
              } />
              <Route path="/staff/table/:id" element={
                <Guard roles={['admin', 'waiter', 'waiter_cook']}><TableDetail /></Guard>
              } />
              <Route path="/staff/orders" element={
                <Guard roles={['admin', 'cook', 'waiter', 'waiter_cook']}><WaiterOrders /></Guard>
              } />
              <Route path="/staff/cooking" element={
                <Guard roles={['admin', 'cook', 'waiter_cook']}><Cooking /></Guard>
              } />
              <Route path="/staff/order/:id" element={
                <Guard roles={['admin', 'waiter', 'cook', 'waiter_cook']}><OrderDetail /></Guard>
              } />
              <Route path="/staff/menu" element={
                <Guard roles={['admin', 'cook', 'waiter_cook']}><MenuManagement /></Guard>
              } />
              <Route path="/staff/menu/category/new" element={
                <Guard roles={['admin', 'cook', 'waiter_cook']}><CategoryEdit /></Guard>
              } />
              <Route path="/staff/menu/category/:id" element={
                <Guard roles={['admin', 'cook', 'waiter_cook']}><CategoryEdit /></Guard>
              } />
              <Route path="/staff/menu/dish/new" element={
                <Guard roles={['admin', 'cook', 'waiter_cook']}><DishEdit /></Guard>
              } />
              <Route path="/staff/menu/dish/:id" element={
                <Guard roles={['admin', 'cook', 'waiter_cook']}><DishEdit /></Guard>
              } />
              <Route path="/staff/menu/pdf" element={
                <Guard roles={['admin', 'cook', 'waiter_cook']}><PdfGenerator /></Guard>
              } />
              <Route path="/staff/extras" element={
                <Guard roles={['admin', 'cook', 'waiter_cook']}><ExtrasManagement /></Guard>
              } />
              <Route path="/staff/extras/:type/new" element={
                <Guard roles={['admin', 'cook', 'waiter_cook']}><ExtrasEdit /></Guard>
              } />
              <Route path="/staff/extras/:type/:id" element={
                <Guard roles={['admin', 'cook', 'waiter_cook']}><ExtrasEdit /></Guard>
              } />
              <Route path="/staff/analytics" element={
                <Guard roles={['admin']}><RequirePlan><Analytics /></RequirePlan></Guard>
              } />
              <Route path="/staff/settings" element={
                <Guard roles={['admin', 'waiter', 'cook']}><StaffSettings /></Guard>
              } />
              <Route path="/staff/restaurant-settings" element={
                <Guard roles={['admin']}><RestaurantSettings /></Guard>
              } />
              <Route path="/staff/staff" element={
                <Guard roles={['admin']}><StaffManagement /></Guard>
              } />
              <Route path="/staff/reviews" element={
                <Guard roles={['admin']}><RequirePlan><ReviewsManagement /></RequirePlan></Guard>
              } />
            </Routes>
            </StaffNotificationsProvider>
          </ClientToastProvider>
        </ThemeProvider>
      </BrowserRouter>
    </MenuProvider>
    </PlanProvider>
    </StaffDataProvider>
    </AppProvider>
    </AuthProvider>
  );
}