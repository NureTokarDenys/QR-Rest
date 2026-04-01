import React, { createContext, useContext, useState } from 'react';
import { orderHistory as initialOrderHistory } from '../data/mockData';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [orderHistory, setOrderHistory] = useState(initialOrderHistory);
  const [cart, setCart] = useState([]);
  const [tableNumber] = useState(5);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [orderComment, setOrderComment] = useState('');

  function addToCart(dish) {
    setCart(prev => {
      const existing = prev.find(item => item.id === dish.id);
      if (existing) {
        return prev.map(item =>
          item.id === dish.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...dish, quantity: 1 }];
    });
  }

  function removeFromCart(dishId) {
    setCart(prev => prev.filter(item => item.id !== dishId));
  }

  function updateQuantity(dishId, delta) {
    setCart(prev => {
      return prev
        .map(item =>
          item.id === dishId ? { ...item, quantity: item.quantity + delta } : item
        )
        .filter(item => item.quantity > 0);
    });
  }

  function clearCart() {
    setCart([]);
  }

  const addOrderToHistory = (newOrder) => {
    const historyItem = {
      id: newOrder.id,
      date: newOrder.date,
      total: newOrder.total,
      status: newOrder.status
    };
    
    setOrderHistory(prevHistory => [historyItem, ...prevHistory]);
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <AppContext.Provider value={{
      cart, addToCart, removeFromCart, updateQuantity, clearCart, 
      cartTotal, cartCount,
      tableNumber,
      currentOrder, setCurrentOrder,
      orderHistory, addOrderToHistory,
      orderComment, setOrderComment,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}