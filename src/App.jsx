import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';
import { ClientToastProvider } from "./context/ClientToastContext";
import Login from './pages/Login';
import StaffPlaceholder from './pages/StaffPlaceholder';
import Menu from './pages/client/Menu';
import Category from './pages/client/Category';
import DishDetail from './pages/client/DishDetail';
import Cart from './pages/client/Cart';
import ConfirmOrder from './pages/client/ConfirmOrder';
import OrderStatus from './pages/client/OrderStatus';
import Profile from './pages/client/Profile';
import OrderHistory from './pages/client/OrderHistory';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <ThemeProvider>
          <ClientToastProvider>
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/staff" element={<StaffPlaceholder />} />
              <Route path="/menu" element={<Menu />} />
              <Route path="/category/:id" element={<Category />} />
              <Route path="/dish/:id" element={<DishDetail />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/confirm" element={<ConfirmOrder />} />
              <Route path="/order-status" element={<OrderStatus />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/order-history" element={<OrderHistory />} />
            </Routes>
          </ClientToastProvider>
        </ThemeProvider>
      </BrowserRouter>
    </AppProvider>
  );
}