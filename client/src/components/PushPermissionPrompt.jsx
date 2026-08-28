import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import { requestPushPermission } from '../utils/push';

// Pre-permission UI required by Apple guideline 4.5.4. The OS permission
// prompt must follow a contextualized user action — this component shows
// explanatory copy first ("Get reminders for your scheduled workouts")
// and only calls requestPushPermission() after the user taps Enable.
//
// Self-gates:
//   - Native platforms only (web/PWA is a no-op).
//   - Renders once per user-device. Tapping Enable or Not Now sets a
//     localStorage flag so it never re-shows; if the user wants to enable
//     later they go through Settings or a future "Enable Notifications"
//     entry in Profile.
//   - Only shows when the OS permission status is still "prompt" — if the
//     user already granted (via a prior version of the app) or denied, we
//     skip entirely.
//
// Mounted from Layout.jsx so it only renders for authed users.

const SEEN_KEY = 'replab.push-prompt-seen';

export default function PushPermissionPrompt() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!Capacitor.isNativePlatform()) return;
      try {
        if (localStorage.getItem(SEEN_KEY)) return;
      } catch (_) { /* SSR / private mode — bail */ return; }
      try {
        const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
        const perm = await FirebaseMessaging.checkPermissions();
        if (cancelled) return;
        if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
          // Small delay so the prompt doesn't appear DURING the splash → home
          // transition (that reads as a launch prompt to App Review).
          setTimeout(() => { if (!cancelled) setOpen(true); }, 2500);
        }
      } catch (err) {
        if (import.meta.env.DEV) console.warn('[push-prompt] check failed:', err?.message || err);
      }
    }
    check();
    return () => { cancelled = true; };
  }, []);

  function markSeen() {
    try { localStorage.setItem(SEEN_KEY, '1'); } catch (_) {}
  }

  async function handleEnable() {
    if (busy) return;
    setBusy(true);
    markSeen();
    try {
      await requestPushPermission();
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  function handleSkip() {
    markSeen();
    setOpen(false);
  }

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex items-end justify-center px-4 pb-6"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="push-prompt-title"
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #1a1816 0%, #100f0d 100%)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        <div className="px-5 pt-6 pb-3 text-center">
          <div
            className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-4"
            style={{
              background: 'linear-gradient(135deg, rgba(239,68,68,0.25) 0%, rgba(220,38,38,0.15) 100%)',
              border: '1px solid rgba(239,68,68,0.35)',
            }}
            aria-hidden="true"
          >
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
          </div>
          <h3 id="push-prompt-title" className="text-[18px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui' }}>
            Stay on track with workout reminders
          </h3>
          <p className="mt-2 text-[13px] text-white/70 leading-relaxed">
            Get notified when it's time for a scheduled workout so you never miss a session. We only send the reminders you set up — no spam.
          </p>
        </div>
        <div className="px-5 pb-5 pt-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleEnable}
            disabled={busy}
            className="active:scale-[0.97] transition-all text-white text-[11px] font-bold uppercase px-4 py-3 w-full disabled:opacity-60"
            style={{
              letterSpacing: '0.18em',
              borderRadius: '2px',
              background: 'linear-gradient(135deg, rgba(239,68,68,0.95) 0%, rgba(220,38,38,0.95) 100%)',
              boxShadow: '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
            }}
          >
            {busy ? 'Enabling…' : 'Enable Reminders'}
          </button>
          <button
            type="button"
            onClick={handleSkip}
            disabled={busy}
            className="active:scale-[0.97] transition-all text-white/70 text-[11px] font-bold uppercase px-4 py-2.5 w-full disabled:opacity-60"
            style={{
              letterSpacing: '0.18em',
              borderRadius: '2px',
              background: 'rgba(255,255,255,0.04)',
            }}
          >
            Not Now
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
