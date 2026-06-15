import { createContext, useContext, useState, useRef } from "react";
import ClientToast from "../components/client/Toast";

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

  // Second arg is optional — { onClick } passes a click handler through to the
  // toast so client-side callers can redirect (e.g. to /cart) while staff-side
  // save toasts behave as a plain dismiss.
  const showToast = (message, options = {}) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    const id = Date.now();
    setToast({ message, id, onClick: options.onClick });

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
          onClick={toast.onClick}
        />
      )}
    </ClientToastContext.Provider>
  );
};

export const useToast = () => useContext(ClientToastContext);