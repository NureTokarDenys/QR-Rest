import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'; // Navigate used by /staff redirect
import { AppProvider, useApp } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ClientToastProvider } from "./context/ClientToastContext";
import ProtectedRoute from './components/ProtectedRoute';
import HttpErrorToast from './components/HttpErrorToast';
import NotificationToast from './components/client/NotificationToast';
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
      <BrowserRouter>
        <ThemeProvider>
          <ClientToastProvider>
            {/* Global HTTP error overlay — catches all unhandled 4xx / 5xx */}
            <HttpErrorToast />
            {/* Persistent notification banner for guest order events */}
            <NotificationToast />
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

              {/* Client routes — open to everyone */}
              <Route path="/menu" element={<Menu />} />
              <Route path="/category/:id" element={<Category />} />
              <Route path="/dish/:id" element={<DishDetail />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/confirm" element={<ConfirmOrder />} />
              <Route path="/order-status" element={<OrderStatus />} />
              <Route path="/order-status/:orderId" element={<OrderStatus />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/order-history" element={<OrderHistory />} />
              <Route path="/restaurant-reviews" element={<RestaurantReviews />} />

              {/* Staff routes — role-gated */}
              <Route path="/staff" element={<Navigate to="/staff/map" replace />} />

              <Route path="/staff/map" element={
                <Guard roles={['admin', 'waiter', 'waiter_cook']}><TableMap /></Guard>
              } />
              <Route path="/staff/table/:id" element={
                <Guard roles={['admin', 'waiter', 'waiter_cook']}><TableDetail /></Guard>
              } />
              <Route path="/staff/orders" element={
                <Guard roles={['admin', 'waiter', 'waiter_cook']}><WaiterOrders /></Guard>
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
                <Guard roles={['admin']}><CategoryEdit /></Guard>
              } />
              <Route path="/staff/menu/category/:id" element={
                <Guard roles={['admin']}><CategoryEdit /></Guard>
              } />
              <Route path="/staff/menu/dish/new" element={
                <Guard roles={['admin']}><DishEdit /></Guard>
              } />
              <Route path="/staff/menu/dish/:id" element={
                <Guard roles={['admin']}><DishEdit /></Guard>
              } />
              <Route path="/staff/menu/pdf" element={
                <Guard roles={['admin']}><PdfGenerator /></Guard>
              } />
              <Route path="/staff/extras" element={
                <Guard roles={['admin', 'cook', 'waiter_cook']}><ExtrasManagement /></Guard>
              } />
              <Route path="/staff/analytics" element={
                <Guard roles={['admin']}><Analytics /></Guard>
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
                <Guard roles={['admin']}><ReviewsManagement /></Guard>
              } />
            </Routes>
          </ClientToastProvider>
        </ThemeProvider>
      </BrowserRouter>
    </AppProvider>
    </AuthProvider>
  );
}