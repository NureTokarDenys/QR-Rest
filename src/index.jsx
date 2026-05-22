import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n/index.js';
import './App.css';
import './global.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

// Register the PWA service worker. Production-only — in dev the Vite HMR
// runtime owns the network and a SW would intercept module requests.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('[sw] registration failed:', err?.message);
    });
  });
}