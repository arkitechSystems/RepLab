import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

// Show the install prompt after the user has been around long enough to
// have a reason to install. Not immediately — that's annoying for new visitors.
const SHOW_DELAY_MS = 5_000;
const DISMISS_COOLDOWN_DAYS = 14;
const DISMISS_KEY = 'replab:install-dismissed-at';

function isIOSDevice() {
  if (typeof navigator === 'undefined') return false;
  // iPhone/iPod still report literally in the UA. iPad on iOS 13+ ships a
  // desktop-Mac UA by default, but it's still WebKit + touch-capable, so
  // we second-test for that combo. `MSStream` rejects old IE on Windows
  // Phone which spoofs iPhone in some cases.
  if (window.MSStream) return false;
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return true;
  const isMacUA = /Macintosh/.test(navigator.userAgent);
  const hasTouch = (navigator.maxTouchPoints || 0) > 1;
  return isMacUA && hasTouch;
}

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    window.navigator.standalone === true // iOS-specific flag
  );
}

function wasRecentlyDismissed() {
  try {
    const ts = localStorage.getItem(DISMISS_KEY);
    if (!ts) return false;
    return Date.now() - Number(ts) < DISMISS_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [ready, setReady] = useState(false); // 30s engagement elapsed
  const [ios, setIos] = useState(false);
  const [visible, setVisible] = useState(true); // becomes false on dismiss/install

  useEffect(() => {
    // Hard-block on native Capacitor wrappers (iOS/Android App Store builds).
    // The 'install this as a PWA' banner is meaningless inside a real
    // native app and would get flagged by App Review as broken UX.
    if (Capacitor.isNativePlatform()) {
      setVisible(false);
      return;
    }
    // Never show if already installed or recently dismissed.
    if (isStandalone() || wasRecentlyDismissed()) {
      setVisible(false);
      return;
    }

    setIos(isIOSDevice());

    // Chrome/Android fires beforeinstallprompt when the site qualifies for
    // install. Capture + defer the event so we can trigger it from our own UI.
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // If the user installs via the browser UI directly, hide our prompt.
    const handleInstalled = () => setVisible(false);
    window.addEventListener('appinstalled', handleInstalled);

    const timer = setTimeout(() => setReady(true), SHOW_DELAY_MS);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
      clearTimeout(timer);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } catch {}
    setDeferredPrompt(null);
    setVisible(false);
  };

  const handleDismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
  };

  // Gate rendering on: still visible + engagement delay elapsed + we have
  // something to show (a deferred prompt on Android, or iOS which needs manual steps).
  if (!visible || !ready) return null;
  if (!ios && !deferredPrompt) return null;

  return (
    <div
      className="fixed left-4 right-4 z-50 fade-slide-up"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)', // above bottom nav
        maxWidth: '440px',
        margin: '0 auto',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
          borderRadius: '2px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.7), 0 4px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Red top accent */}
        <div style={{ height: '3px', background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.4), transparent)' }} />
        {/* Ambient red spotlight */}
        <div
          className="absolute -top-10 -right-10 w-[250px] h-[250px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 60%)', filter: 'blur(40px)' }}
        />

        <div className="relative p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p
                className="text-[10px] uppercase font-light mb-1"
                style={{ color: 'rgba(239,68,68,0.8)', letterSpacing: '0.3em' }}
              >
                Install REPLAB
              </p>
              <h3 className="text-[16px] font-black text-white tracking-tight mb-2">
                Add to your home screen
              </h3>
              {ios ? (
                <p className="text-[11px] text-white/50 font-light leading-relaxed">
                  Tap the{' '}
                  <span className="inline-flex items-center align-middle">
                    <svg
                      className="w-3.5 h-3.5 mx-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      style={{ color: 'rgba(96,165,250,0.95)' }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                  </span>
                  Share icon below, then{' '}
                  <span className="text-white font-medium">Add to Home Screen</span>.
                </p>
              ) : (
                <p className="text-[11px] text-white/50 font-light leading-relaxed">
                  Launch fullscreen, no browser bar, one tap from your home screen. Works offline.
                </p>
              )}
            </div>
            <button
              onClick={handleDismiss}
              aria-label="Dismiss install prompt"
              className="w-6 h-6 flex items-center justify-center shrink-0 active:scale-90 transition"
              style={{ color: 'rgba(255,255,255,0.3)' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {!ios && deferredPrompt && (
            <button
              onClick={handleInstall}
              className="w-full mt-3 py-2.5 text-[11px] font-bold uppercase active:scale-[0.97] transition-all"
              style={{
                borderRadius: '2px',
                letterSpacing: '0.2em',
                background: 'linear-gradient(135deg, #fff 0%, #e0e0e0 100%)',
                color: '#000',
                boxShadow: '0 4px 14px rgba(255,255,255,0.1)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Install App
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
