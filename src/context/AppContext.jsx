import React, { createContext, useContext, useState } from 'react';
import { orderHistory as initialOrderHistory } from '../data/mockData';

const AppContext = createContext(null);

const DEFAULT_GROUP_ID = 'main';

export function AppProvider({ children }) {
  const [orderHistory, setOrderHistory] = useState(initialOrderHistory);
  const [cart, setCart] = useState([]);
  const [tableNumber] = useState(5);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [orderComment, setOrderComment] = useState('');
  const [servingGroups, setServingGroups] = useState([
    { id: DEFAULT_GROUP_ID, name: 'Основна група', name_en: 'Main group' }
  ]);

  // cartItem shape: { cartItemId, id, name, name_en, price, image,
  //   quantity, groupId,
  //   excludedIngredients: [ingredientId],
  //   selectedAddons: [addonId],
  //   componentGroupSelections: { [groupId]: optionId },
  //   comment: '' }

  function addToCart(dish, options = {}) {
    const {
      excludedIngredients = [],
      selectedAddons = [],
      componentGroupSelections = {},
      comment = '',
      groupId = DEFAULT_GROUP_ID,
    } = options;

    const addonPrice = (dish.addons || [])
      .filter(a => selectedAddons.includes(a.id))
      .reduce((s, a) => s + a.price, 0);

    const groupPrice = Object.entries(componentGroupSelections).reduce((s, [gid, optId]) => {
      const group = (dish.componentGroups || []).find(g => g.id === gid);
      if (!group) return s;
      const opt = group.options.find(o => o.id === optId);
      return s + (opt ? opt.priceModifier : 0);
    }, 0);

    const unitPrice = dish.price + addonPrice + groupPrice;

    setCart(prev => {
      const cartItemId = `${dish.id}-${Date.now()}-${Math.random()}`;
      return [...prev, {
        cartItemId,
        id: dish.id,
        name: dish.name,
        name_en: dish.name_en,
        price: unitPrice,
        image: dish.image,
        quantity: 1,
        groupId,
        excludedIngredients,
        selectedAddons,
        componentGroupSelections,
        comment,
      }];
    });
  }

  function removeFromCart(cartItemId) {
    setCart(prev => prev.filter(item => item.cartItemId !== cartItemId));
  }

  function updateQuantity(cartItemId, delta) {
    setCart(prev =>
      prev
        .map(item => item.cartItemId === cartItemId
          ? { ...item, quantity: item.quantity + delta }
          : item
        )
        .filter(item => item.quantity > 0)
    );
  }

  function moveToGroup(cartItemId, groupId) {
    setCart(prev => prev.map(item =>
      item.cartItemId === cartItemId ? { ...item, groupId } : item
    ));
  }

  function clearCart() {
    setCart([]);
    setServingGroups([{ id: DEFAULT_GROUP_ID, name: 'Основна група', name_en: 'Main group' }]);
  }

  function addServingGroup(name) {
    const id = `group-${Date.now()}`;
    setServingGroups(prev => [...prev, { id, name, name_en: name }]);
    return id;
  }

  function removeServingGroup(groupId) {
    if (groupId === DEFAULT_GROUP_ID) return;
    setServingGroups(prev => prev.filter(g => g.id !== groupId));
    setCart(prev => prev.map(item =>
      item.groupId === groupId ? { ...item, groupId: DEFAULT_GROUP_ID } : item
    ));
  }

  function renameServingGroup(groupId, name) {
    setServingGroups(prev => prev.map(g =>
      g.id === groupId ? { ...g, name, name_en: name } : g
    ));
  }

  const addOrderToHistory = (newOrder) => {
    setOrderHistory(prevHistory => [newOrder, ...prevHistory]);
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <AppContext.Provider value={{
      cart, addToCart, removeFromCart, updateQuantity, clearCart, moveToGroup,
      cartTotal, cartCount,
      tableNumber,
      currentOrder, setCurrentOrder,
      orderHistory, addOrderToHistory,
      orderComment, setOrderComment,
      servingGroups, addServingGroup, removeServingGroup, renameServingGroup,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
