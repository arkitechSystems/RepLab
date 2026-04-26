import { useState, useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { useTutorial } from '../context/TutorialContext';

const tabs = [
  {
    to: '/',
    label: 'Workouts',
    outline: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
    filled: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" d="M3 6a3 3 0 013-3h2.25a3 3 0 013 3v2.25a3 3 0 01-3 3H6a3 3 0 01-3-3V6zm9.75 0a3 3 0 013-3H18a3 3 0 013 3v2.25a3 3 0 01-3 3h-2.25a3 3 0 01-3-3V6zM3 15.75a3 3 0 013-3h2.25a3 3 0 013 3V18a3 3 0 01-3 3H6a3 3 0 01-3-3v-2.25zm9.75 0a3 3 0 013-3H18a3 3 0 013 3V18a3 3 0 01-3 3h-2.25a3 3 0 01-3-3v-2.25z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    to: '/calendar',
    label: 'Calendar',
    outline: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
    filled: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.75 12.75a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM7.5 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM8.25 17.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM9.75 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM10.5 17.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM12.75 17.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM14.25 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM15 17.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM16.5 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM15 12.75a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM16.5 13.5a.75.75 0 100-1.5.75.75 0 000 1.5z" />
        <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 017.5 3v1.5h9V3A.75.75 0 0118 3v1.5h.75a3 3 0 013 3v11.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V7.5a3 3 0 013-3H6V3a.75.75 0 01.75-.75zm13.5 9a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5v7.5a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5v-7.5z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    to: '/utilities',
    label: 'Utilities',
    outline: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.1-5.1m0 0L3.07 12.315a.927.927 0 010-1.31l6.244-6.244a.927.927 0 011.31 0L13.87 8.01m-7.55 2.06L3.07 12.315m5.25-5.25l2.122 2.122m-5.12 5.122l2.121 2.122M14.58 8.83l5.1 5.1m0 0l3.243-2.247a.927.927 0 000-1.31l-6.244-6.244a.927.927 0 00-1.31 0L10.13 8.83m7.55 2.06l3.243-2.247M14.58 8.83l-2.122 2.122m5.122 5.122l-2.122 2.122" />
      </svg>
    ),
    filled: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" d="M12 6.75a5.25 5.25 0 016.775-5.025.75.75 0 01.313 1.248l-3.32 3.319c.063.475.276.934.641 1.299.365.365.824.578 1.3.641l3.318-3.319a.75.75 0 011.248.313 5.25 5.25 0 01-5.472 6.756c-1.018-.086-1.87.1-2.309.634L7.344 21.3A3.298 3.298 0 112.7 16.657l8.684-7.151c.533-.44.72-1.291.634-2.309A5.342 5.342 0 0112 6.75zM4.117 19.125a.75.75 0 01.75-.75h.008a.75.75 0 01.75.75v.008a.75.75 0 01-.75.75h-.008a.75.75 0 01-.75-.75v-.008z" clipRule="evenodd" />
        <path d="M10.076 8.64l-2.201-2.2V4.874a.75.75 0 00-.364-.643l-3.75-2.25a.75.75 0 00-.916.113l-.75.75a.75.75 0 00-.113.916l2.25 3.75a.75.75 0 00.643.364h1.564l2.062 2.062 1.575-1.297z" />
        <path fillRule="evenodd" d="M12.556 17.329l4.183 4.182a3.375 3.375 0 004.773-4.773l-3.306-3.305a5.286 5.286 0 01-1.055.599l2.987 2.986a1.875 1.875 0 11-2.652 2.652l-3.807-3.808c-.076.138-.158.269-.247.394l-.876.874z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    to: '/profile',
    label: 'Profile',
    outline: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
    filled: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
      </svg>
    ),
  },
];

// How much of the nav stays visible when "hidden" — the drag handle row.
// 22px is enough to see the handle pill and tap/swipe it back up.
const SLIVER_HEIGHT = 22;
// Ignore scroll deltas smaller than this (jitter / inertia tail) so the
// nav doesn't flicker on tiny rubberbands.
const SCROLL_THRESHOLD = 6;
// Don't auto-hide while the user is near the top of the page — they're
// still orienting and likely haven't started consuming content.
const SCROLL_TRIGGER_Y = 80;
// During a touch drag, this is how far the user has to move before we
// commit the show/hide. Smaller values feel snappy; bigger feels safer
// against accidental drags.
const DRAG_COMMIT_PX = 28;
// Below this drag delta we don't even start moving the nav, so a quick
// tap on a tab still registers as a click instead of a tiny drag.
const DRAG_DEAD_ZONE_PX = 6;
const HINT_KEY = 'replab-nav-hide-hint';

export default function BottomNav() {
  const { tutorial } = useTutorial();
  const [hidden, setHidden] = useState(false);
  const [dragY, setDragY] = useState(0);     // current touch-driven offset
  const [touching, setTouching] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const navRef = useRef(null);
  const lastScrollYRef = useRef(0);
  const touchStartRef = useRef({ y: 0, hidden: false });

  // First-time hint shown once per device when the nav first hides. Lives
  // briefly above the sliver so the user knows where to grab to bring it
  // back; localStorage flag stops it from ever showing again.
  function maybeShowHint() {
    try {
      if (localStorage.getItem(HINT_KEY) === 'shown') return;
      localStorage.setItem(HINT_KEY, 'shown');
    } catch { /* private mode — show once per session is fine */ }
    setShowHint(true);
    setTimeout(() => setShowHint(false), 3500);
  }

  // Auto-hide on scroll-down, restore on scroll-up. Skipped during the
  // tutorial since the tutorial overlays target nav tabs by position and
  // a hidden nav would break the highlights.
  useEffect(() => {
    if (tutorial?.active) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastScrollYRef.current;
        if (Math.abs(delta) >= SCROLL_THRESHOLD) {
          if (y < SCROLL_TRIGGER_Y) {
            setHidden(false);
          } else if (delta > 0) {
            setHidden((prev) => {
              if (!prev) maybeShowHint();
              return true;
            });
          } else {
            setHidden(false);
          }
          lastScrollYRef.current = y;
        }
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [tutorial?.active]);

  // Force-show the nav whenever a tutorial starts so the highlight ring
  // can find the tab buttons.
  useEffect(() => {
    if (tutorial?.active) setHidden(false);
  }, [tutorial?.active]);

  const onTouchStart = (e) => {
    touchStartRef.current = {
      y: e.touches[0].clientY,
      hidden,
    };
    setTouching(true);
    setDragY(0);
  };

  const onTouchMove = (e) => {
    const dy = e.touches[0].clientY - touchStartRef.current.y;
    if (Math.abs(dy) < DRAG_DEAD_ZONE_PX) {
      // Within dead zone — leave nav alone so taps still feel like taps.
      if (dragY !== 0) setDragY(0);
      return;
    }
    if (touchStartRef.current.hidden) {
      // Hidden — only respond to upward drag (negative dy).
      setDragY(Math.max(Math.min(0, dy), -240));
    } else {
      // Visible — only respond to downward drag (positive dy).
      setDragY(Math.min(Math.max(0, dy), 240));
    }
  };

  const onTouchEnd = () => {
    const startedHidden = touchStartRef.current.hidden;
    if (startedHidden && dragY < -DRAG_COMMIT_PX) {
      setHidden(false);
    } else if (!startedHidden && dragY > DRAG_COMMIT_PX) {
      setHidden(true);
      maybeShowHint();
    }
    setTouching(false);
    setDragY(0);
  };

  // Tapping the sliver while hidden is also a way to bring the nav back
  // — guards against users who don't realize they can drag a 22px target.
  const onSliverClick = () => {
    if (hidden) setHidden(false);
  };

  // Compute final translateY. During a touch we follow the finger; at
  // rest we snap to either 0 or (navHeight - sliverHeight). navHeight is
  // measured from the DOM so the math respects safe-area-inset-bottom.
  const navHeight = navRef.current?.offsetHeight ?? 80;
  const baseHidden = Math.max(0, navHeight - SLIVER_HEIGHT);
  let translateY;
  if (touching) {
    translateY = (touchStartRef.current.hidden ? baseHidden : 0) + dragY;
  } else {
    translateY = hidden ? baseHidden : 0;
  }

  return (
    <>
      {/* First-time hint toast — sits just above the sliver so the user
          can see where to drag from. Auto-dismisses after 3.5s and never
          shows again on this device. */}
      {showHint && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-[60] pointer-events-none animate-fade-in"
          style={{
            bottom: `calc(env(safe-area-inset-bottom, 0px) + ${SLIVER_HEIGHT + 14}px)`,
            background: 'rgba(0,0,0,0.85)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '999px',
            padding: '8px 14px',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.85)',
            whiteSpace: 'nowrap',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}
        >
          ↑ Pull up to show nav
        </div>
      )}

      <nav
        ref={navRef}
        className="fixed bottom-0 left-0 right-0 safe-bottom z-50"
        style={{
          background: '#0a0a0a',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          transform: `translateY(${translateY}px)`,
          transition: touching ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          touchAction: 'pan-y',
          willChange: 'transform',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onClick={hidden ? onSliverClick : undefined}
      >
        {/* Drag handle — sits in the top sliver so it's the only thing
            visible when hidden. Doubles as the tap target for restore. */}
        <div className="pt-1.5 pb-1 flex justify-center">
          <div
            className="rounded-full transition-colors"
            style={{
              width: '36px',
              height: '4px',
              background: hidden ? 'rgba(239,68,68,0.7)' : 'rgba(255,255,255,0.22)',
              boxShadow: hidden ? '0 0 10px rgba(239,68,68,0.45)' : 'none',
            }}
          />
        </div>

        <div className="flex items-stretch h-16 max-w-lg mx-auto">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === '/'}
              data-tutorial={`nav-${tab.label.toLowerCase()}`}
              className="flex-1 flex flex-col items-center justify-center gap-1 active:scale-[0.97] transition-transform relative"
            >
              {({ isActive }) => (
                <>
                  {/* Top red accent bar — 32px × 2px, centered, only when
                      this tab is active. Sharp 2px edges, no rounding, to
                      match the rest of the Nike-style cards. */}
                  {isActive && (
                    <div
                      className="absolute top-0 left-1/2 -translate-x-1/2"
                      style={{ width: '32px', height: '2px', background: '#ef4444' }}
                    />
                  )}
                  <div
                    className="relative overflow-hidden"
                    style={{ color: isActive ? '#ef4444' : 'rgba(255,255,255,0.45)' }}
                  >
                    {isActive ? tab.filled : tab.outline}
                    {/* One-shot white sweep across the icon when this tab
                        becomes active. The element only mounts in the
                        isActive branch, so the CSS animation fires fresh
                        each time the user selects this tab. */}
                    {isActive && <span className="nav-icon-flash" aria-hidden="true" />}
                  </div>
                  <span
                    className="text-[9px] font-bold uppercase"
                    style={{
                      letterSpacing: '0.18em',
                      color: isActive ? '#ef4444' : 'rgba(255,255,255,0.45)',
                    }}
                  >
                    {tab.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}
