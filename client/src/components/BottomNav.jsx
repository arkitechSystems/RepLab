import { useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { pathKey } from '../queries/keys';

// "Center Seal" nav: solid black grain bar, two tabs either side of a raised
// engraved play button. Icons are clean line-art (1.8 stroke, round
// caps/joins); the active tab is a split-flap tile with a red outline, glow
// and light sweep — the icon itself doesn't change shape.
const tabs = [
  {
    // Dashboard moved from '/' to '/app' (2026-05) so the public landing
    // page can live at the root for all web visitors.
    to: '/app',
    label: 'Workouts',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full" aria-hidden="true">
        <path d="M6.5 6.5l11 11" />
        <path d="M21 21l-1-1" />
        <path d="M3 3l1 1" />
        <path d="M18 22l4-4" />
        <path d="M2 6l4-4" />
        <path d="M3 10l7-7" />
        <path d="M14 21l7-7" />
      </svg>
    ),
  },
  {
    to: '/calendar',
    label: 'Calendar',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  },
  {
    to: '/utilities',
    label: 'Utilities',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full" aria-hidden="true">
        <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
      </svg>
    ),
  },
  {
    to: '/profile',
    label: 'Profile',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full" aria-hidden="true">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

const NV_RED = '#e23a3a';
const NV_MONO = "'JetBrains Mono', ui-monospace, monospace";
const NV_GRAIN = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.09 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

function NavSealButton({ onClick, hidden = false }) {
  const s = 66;
  return (
    <button onClick={onClick} tabIndex={hidden ? -1 : undefined} aria-label="Start workout" className="active:scale-95 transition-transform" style={{ position: 'relative', width: s, height: s, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}>
      <span className="nv-pulse" style={{ position: 'absolute', inset: -6, borderRadius: '50%', border: '1.5px solid rgba(226,58,58,0.7)' }} />
      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle at 50% 30%, #222226 0%, #0b0b0d 60%, #000 100%)', border: `1.5px solid ${NV_RED}`, boxShadow: '0 0 0 4px rgba(226,58,58,0.12), 0 0 26px rgba(226,58,58,0.45), 0 14px 30px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.2)' }} />
      <svg width={s} height={s} viewBox="0 0 100 100" className="nv-spin" style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
        {Array.from({ length: 60 }).map((_, i) => {
          const a = (i / 60) * Math.PI * 2, r1 = 44, r2 = i % 5 === 0 ? 38 : 41;
          return <line key={i} x1={50 + r1 * Math.cos(a)} y1={50 + r1 * Math.sin(a)} x2={50 + r2 * Math.cos(a)} y2={50 + r2 * Math.sin(a)} stroke="rgba(255,255,255,0.32)" strokeWidth={i % 5 === 0 ? 1.2 : 0.6} />;
        })}
      </svg>
      <svg width={s} height={s} viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
        <defs>
          <linearGradient id="nvRing" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" /><stop offset="0.45" stopColor="#6d6d73" />
            <stop offset="0.7" stopColor="#e9e9ee" /><stop offset="1" stopColor="#3a3a3f" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="34" fill="none" stroke="url(#nvRing)" strokeWidth="2.2" />
      </svg>
      <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff" style={{ marginLeft: 3, filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.6))' }} aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z" /></svg>
      </span>
    </button>
  );
}

function NavTab({ tab }) {
  return (
    <NavLink
      to={tab.to}
      end={tab.to === '/app'}
      data-tutorial={`nav-${tab.label.toLowerCase()}`}
      style={{ flex: 1, display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 2 }}
      className="active:scale-[0.97] transition-transform"
    >
      {({ isActive: on }) => (
        <div style={{
          position: 'relative', overflow: 'hidden', width: '100%', maxWidth: 74, height: 56, borderRadius: 12,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5,
          background: on ? 'linear-gradient(180deg, #232327 0%, #161619 49.5%, #0a0a0c 50.5%, #141417 100%)' : 'transparent',
          border: on ? `1.5px solid ${NV_RED}` : '1.5px solid transparent',
          boxShadow: on ? '0 0 0 3px rgba(226,58,58,0.12), 0 0 18px rgba(226,58,58,0.35), inset 0 1px 0 rgba(255,255,255,0.12)' : 'none',
        }}>
          {on && <span className="nv-shine" aria-hidden="true" />}
          {on && <span aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, background: 'rgba(0,0,0,0.9)', boxShadow: '0 1px 0 rgba(255,255,255,0.05)' }} />}
          <div style={{ position: 'relative', zIndex: 2, width: 21, height: 21, color: on ? '#fff' : 'rgba(255,255,255,0.42)' }}>
            {tab.icon}
          </div>
          <span style={{ position: 'relative', zIndex: 2, fontFamily: NV_MONO, fontSize: 8, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: on ? '#fff' : 'rgba(255,255,255,0.4)' }}>
            {tab.label}
          </span>
        </div>
      )}
    </NavLink>
  );
}

// Routes where the user is inside a workout — the play button tucks away.
const IN_SESSION = /^\/(session|featured-session|tutorial\/workout)(\/|$)/;

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Whether today has a workout that isn't marked complete (scheduled, or
// started and unfinished). Re-checked on every route change and when the
// app comes back to the foreground, so Mark Complete, Calendar edits and a
// new day are picked up. Keeps the last answer while a check is in flight
// (no flicker); if a check fails it falls back to the saved answer.
function useTodayWorkoutPending() {
  const { pathname } = useLocation();
  const inSession = IN_SESSION.test(pathname);
  const path = `/schedule/today?date=${localToday()}`;
  // Saved answer first (instant, works offline), then the live one; if a
  // check fails the last answer stands, and with neither it's hidden.
  // Quiet: one attempt, never drives the connection banner. Re-checked when
  // the app returns to the foreground (refetchOnWindowFocus) and below on
  // every route change.
  const { data, refetch } = useQuery({
    queryKey: pathKey(path),
    queryFn: ({ signal }) => api(path, { signal, noRetryPrompt: true }),
    enabled: !inSession, // hidden in a session anyway
    retry: false,
    staleTime: 0,
    meta: { quiet: true },
  });

  const prevPath = useRef(pathname);
  useEffect(() => {
    if (prevPath.current === pathname) return; // mount loads on its own
    prevPath.current = pathname;
    if (!inSession) refetch();
  }, [pathname, inSession, refetch]);

  return !!data?.show;
}

export default function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const todayPending = useTodayWorkoutPending();
  const showSeal = todayPending && !IN_SESSION.test(pathname);
  // Hands off to the home screen, which runs the same start/resume flow as
  // its "Start Now" / "Resume" button (missed-workout prompt, warm-up gate,
  // featured flow). See the startToday effect in pages/Workouts.jsx.
  const handleStart = () => navigate('/app', { state: { startToday: Date.now() } });
  const left = tabs.slice(0, 2);
  const right = tabs.slice(2);
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50" style={{ paddingTop: 26, pointerEvents: 'none' }}>
      <div
        className="safe-bottom"
        style={{
          position: 'relative', overflow: 'hidden', pointerEvents: 'auto',
          background: 'linear-gradient(180deg, #17171a 0%, #08080a 55%, #000 100%)',
          borderTop: '1px solid rgba(255,255,255,0.10)',
          boxShadow: '0 -18px 40px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.12)',
        }}
      >
        {/* Texture layers: grain, specular top edge, soft top-left glow */}
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, backgroundImage: NV_GRAIN, mixBlendMode: 'overlay', opacity: 0.9, pointerEvents: 'none' }} />
        <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)', pointerEvents: 'none' }} />
        <div aria-hidden="true" style={{ position: 'absolute', top: -70, left: -30, width: 240, height: 150, background: 'radial-gradient(closest-side, rgba(255,255,255,0.06), transparent)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', height: 70, display: 'flex', alignItems: 'flex-start', padding: '8px 6px 0' }}>
          {left.map((t) => <NavTab key={t.to} tab={t} />)}
          {/* Middle gap for the seal — closes when the seal tucks away so
              the four tabs spread evenly across the bar. */}
          <div className="nv-gap" style={{ flex: `0 0 ${showSeal ? 84 : 0}px` }} />
          {right.map((t) => <NavTab key={t.to} tab={t} />)}
        </div>
      </div>

      {/* Raised centre seal — only while today has an unfinished workout and
          the user isn't in a session. Shrinks down into the bar to hide. */}
      <div
        className={`nv-seal${showSeal ? '' : ' nv-seal-hidden'}`}
        aria-hidden={!showSeal}
        style={{ position: 'absolute', top: 0, left: '50%', zIndex: 3, pointerEvents: showSeal ? 'auto' : 'none' }}
      >
        <NavSealButton onClick={handleStart} hidden={!showSeal} />
      </div>
    </nav>
  );
}
