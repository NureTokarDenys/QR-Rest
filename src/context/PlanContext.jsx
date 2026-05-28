import React, { createContext, useContext } from 'react';
import { useStaffData } from './StaffDataContext';

const PlanContext = createContext(null);

/**
 * The plan is just one field on the cached restaurant document. No separate
 * fetch — we read it from the shared StaffDataContext, so a plan switch (or
 * a RESTAURANT_UPDATED WS event) propagates everywhere instantly.
 */
export function PlanProvider({ children }) {
  const { restaurant } = useStaffData();
  const plan = restaurant?.plan ?? null; // null until loaded — lets usePlan() fall through to AppContext on client pages
  const planLoading = restaurant === null;

  return (
    <PlanContext.Provider value={{ plan, isPremium: plan === 'premium', planLoading }}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlanContext() {
  return useContext(PlanContext);
}
