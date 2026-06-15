import React, { createContext, useContext, useState } from 'react';

const StaffLayoutContext = createContext(null);

export function StaffLayoutProvider({ children }) {
  const [panelOpen, setPanelOpen] = useState(false);

  function togglePanel() { setPanelOpen(p => !p); }
  function closePanel()  { setPanelOpen(false); }

  return (
    <StaffLayoutContext.Provider value={{ panelOpen, togglePanel, closePanel }}>
      {children}
    </StaffLayoutContext.Provider>
  );
}

export function useStaffLayout() {
  return useContext(StaffLayoutContext);
}