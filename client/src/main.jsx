import './sentry'; // Initialize Sentry before anything else
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { initAnalytics } from './utils/analytics';
import './index.css';

// Initialize Posthog analytics (no-op if VITE_POSTHOG_KEY is not set)
initAnalytics();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// Register service worker for offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });

  // When coming back online, trigger sync
  window.addEventListener('online', () => {
    navigator.serviceWorker.ready.then((reg) => {
      if (reg.sync) {
        reg.sync.register('replab-sync');
      } else {
        // Fallback: message the SW directly
        reg.active?.postMessage('process-sync-queue');
      }
    });
  });
}
