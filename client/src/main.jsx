import './sentry'; // Initialize Sentry before anything else
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { initAnalytics } from './utils/analytics';
import { reportInstall } from './utils/installTracking';
import './index.css';

// Native app only: stop iOS auto-zooming when a text input under 16px gets
// focus. The zoom sticks after blur, which let pages pan sideways and made
// the fixed bottom nav slide off-screen. maximum-scale=1 also disables
// pinch-zoom, so the website (index.html's viewport) keeps pinch-zoom.
if (Capacitor.isNativePlatform()) {
  document
    .querySelector('meta[name="viewport"]')
    ?.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1, viewport-fit=cover');
}

// Initialize Posthog analytics (no-op if VITE_POSTHOG_KEY is not set)
initAnalytics();

// Native app install tracking (first_app_open + POST /installs). No-op on web;
// fire-and-forget, retries on next launch if the report fails.
reportInstall();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// Service worker — production only. In dev, Vite serves fast-changing modules
// at stable URLs, and the SW's cache-first strategy would poison the bundle
// across reloads. We also actively unregister any SW left over from a prior
// run so dev users self-heal on next load.
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });

    window.addEventListener('online', () => {
      navigator.serviceWorker.ready.then((reg) => {
        if (reg.sync) {
          reg.sync.register('replab-sync');
        } else {
          reg.active?.postMessage('process-sync-queue');
        }
      });
    });
  } else {
    // Dev kill-switch: unregister any previously-installed SW and drop its caches.
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    }).catch(() => {});
    if (typeof caches !== 'undefined') {
      caches.keys().then((keys) => {
        keys.forEach((k) => caches.delete(k));
      }).catch(() => {});
    }
  }
}
