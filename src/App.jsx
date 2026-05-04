import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ClientToastProvider } from "./context/ClientToastContext";
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Forbidden from './pages/Forbidden';
import Menu from './pages/client/Menu';
import Category from './pages/client/Category';
import DishDetail from './pages/client/DishDetail';
import Cart from './pages/client/Cart';
import ConfirmOrder from './pages/client/ConfirmOrder';
import OrderStatus from './pages/client/OrderStatus';
import Profile from './pages/client/Profile';
import OrderHistory from './pages/client/OrderHistory';
import TableMap from './pages/staff/TableMap';
import TableDetail from './pages/staff/TableDetail';
import Cooking from './pages/staff/Cooking';
import OrderDetail from './pages/staff/OrderDetail';
import MenuManagement from './pages/staff/MenuManagement';
import DishEdit from './pages/staff/DishEdit';
import PdfGenerator from './pages/staff/PdfGenerator';
import Analytics from './pages/staff/Analytics';
import StaffSettings from './pages/staff/StaffSettings';

// Helper to wrap a page with ProtectedRoute
function Guard({ roles, children }) {
  return <ProtectedRoute requiredRoles={roles}>{children}</ProtectedRoute>;
}

export default function App() {
  return (
    <AuthProvider>
    <AppProvider>
      <BrowserRouter>
        <ThemeProvider>
          <ClientToastProvider>
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/forbidden" element={<Forbidden />} />

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

              {/* Staff routes — role-gated */}
              <Route path="/staff" element={<Navigate to="/staff/map" replace />} />

              <Route path="/staff/map" element={
                <Guard roles={['admin', 'waiter']}><TableMap /></Guard>
              } />
              <Route path="/staff/table/:id" element={
                <Guard roles={['admin', 'waiter']}><TableDetail /></Guard>
              } />
              <Route path="/staff/cooking" element={
                <Guard roles={['admin', 'cook']}><Cooking /></Guard>
              } />
              <Route path="/staff/order/:id" element={
                <Guard roles={['admin', 'waiter', 'cook']}><OrderDetail /></Guard>
              } />
              <Route path="/staff/menu" element={
                <Guard roles={['admin']}><MenuManagement /></Guard>
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
              <Route path="/staff/analytics" element={
                <Guard roles={['admin']}><Analytics /></Guard>
              } />
              <Route path="/staff/settings" element={
                <Guard roles={['admin', 'waiter', 'cook']}><StaffSettings /></Guard>
              } />
            </Routes>
          </ClientToastProvider>
        </ThemeProvider>
      </BrowserRouter>
    </AppProvider>
    </AuthProvider>
  );
}