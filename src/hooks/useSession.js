import { useState } from 'react';
import { scanQR } from '../api/qr';

export function useSession() {
  const [sessionToken, setSessionToken] = useState(() => localStorage.getItem('sessionToken'));
  const [tableId, setTableId] = useState(() => localStorage.getItem('tableId'));
  const [tableNumber, setTableNumber] = useState(() => localStorage.getItem('tableNumber'));
  const [restaurantId, setRestaurantId] = useState(() => localStorage.getItem('restaurantId'));

  async function initSession(shortCode) {
    const data = await scanQR(shortCode);
    const { sessionToken: st, tableId: tid, tableNumber: tn, restaurantId: rid } = data;
    localStorage.setItem('sessionToken', st);
    localStorage.setItem('tableId', String(tid));
    localStorage.setItem('tableNumber', String(tn));
    localStorage.setItem('restaurantId', String(rid));
    setSessionToken(st);
    setTableId(String(tid));
    setTableNumber(String(tn));
    setRestaurantId(String(rid));
    return data;
  }

  return { sessionToken, tableId, tableNumber, restaurantId, initSession };
}
