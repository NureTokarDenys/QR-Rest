import { createContext, useContext, useState, useRef } from "react";
import ClientToast from "../components/ClientToast";

const ClientToastContext = createContext();

export const ClientToastProvider = ({ children }) => {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const hideToast = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setToast(null);
  };

  const showToast = (message) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    const id = Date.now();
    setToast({ message, id });

    timerRef.current = setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  return (
    <ClientToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {toast && (
        <ClientToast 
          message={toast.message} 
          key={toast.id} 
          onClose={hideToast} 
        />
      )}
    </ClientToastContext.Provider>
  );
};

export const useToast = () => useContext(ClientToastContext);