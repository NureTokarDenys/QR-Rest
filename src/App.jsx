import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ClientToastProvider } from "./context/ClientToastContext";
import Login from './pages/Login';
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
              <Route path="/menu" element={<Menu />} />
              <Route path="/category/:id" element={<Category />} />
              <Route path="/dish/:id" element={<DishDetail />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/confirm" element={<ConfirmOrder />} />
              <Route path="/order-status" element={<OrderStatus />} />
              <Route path="/order-status/:orderId" element={<OrderStatus />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/order-history" element={<OrderHistory />} />

              <Route path="/staff" element={<Navigate to="/staff/map" replace />} />
              <Route path="/staff/map" element={<TableMap />} />
              <Route path="/staff/table/:id" element={<TableDetail />} />
              <Route path="/staff/cooking" element={<Cooking />} />
              <Route path="/staff/order/:id" element={<OrderDetail />} />
              <Route path="/staff/menu" element={<MenuManagement />} />
              <Route path="/staff/menu/dish/new" element={<DishEdit />} />
              <Route path="/staff/menu/dish/:id" element={<DishEdit />} />
              <Route path="/staff/menu/pdf" element={<PdfGenerator />} />
              <Route path="/staff/analytics" element={<Analytics />} />
              <Route path="/staff/settings" element={<StaffSettings />} />
            </Routes>
          </ClientToastProvider>
        </ThemeProvider>
      </BrowserRouter>
    </AppProvider>
    </AuthProvider>
  );
}