import { useState, useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { useTutorial } from '../context/TutorialContext';

// Icons match the V01 "Nike Sharp" variant on /test/navbars: clean
// line-art (1.8 stroke, round caps/joins), no filled vs outline split,
// 18×18 wrapper inside each tab. The active state communicates via color
// + the top red accent bar — the icon itself doesn't change shape.
const tabs = [
  {
    to: '/',
    label: 'Workouts',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
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
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  },
  {
    to: '/utilities',
    label: 'Utilities',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
        <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
      </svg>
    ),
  },
  {
    to: '/profile',
    label: 'Profile',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
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
              className="flex-1 flex flex-col items-center justify-center gap-1 active:scale-[0.97] transition-transform relative overflow-hidden"
            >
              {({ isActive }) => (
                <>
                  {/* Top red accent bar — 32px × 2px, centered, only when
                      this tab is active. Sharp 2px edges, no rounding, to
                      match the rest of the Nike-style cards. */}
                  {isActive && (
                    <div
                      className="absolute top-0 left-1/2 -translate-x-1/2 z-10"
                      style={{ width: '32px', height: '2px', background: '#ef4444' }}
                    />
                  )}
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      color: isActive ? '#ef4444' : 'rgba(255,255,255,0.45)',
                      // Soft whitish-gray halo on the active icon — uses
                      // drop-shadow on the wrapper so the glow tracks the
                      // SVG strokes themselves, not a rectangular bounding
                      // box. Two stacked shadows: a tight inner glow and
                      // a wider outer bloom.
                      filter: isActive
                        ? 'drop-shadow(0 0 2px rgba(255,255,255,0.55)) drop-shadow(0 0 6px rgba(229,231,235,0.35))'
                        : 'none',
                    }}
                  >
                    {tab.icon}
                  </div>
                  <span
                    className="text-[9px] font-bold uppercase"
                    style={{
                      letterSpacing: '0.18em',
                      color: isActive ? '#ef4444' : 'rgba(255,255,255,0.45)',
                      // Same whitish-gray halo as the active icon, but
                      // expressed as text-shadow so it tracks each glyph
                      // outline. Two stacked shadows: tight inner + softer
                      // outer bloom.
                      textShadow: isActive
                        ? '0 0 2px rgba(255,255,255,0.55), 0 0 6px rgba(229,231,235,0.35)'
                        : 'none',
                    }}
                  >
                    {tab.label}
                  </span>
                  {/* One-shot white sweep across the entire tab cell when
                      it becomes active — covers icon + label, matching the
                      footprint of the red glow pill. Only mounts in the
                      isActive branch so the CSS animation fires fresh on
                      each selection. */}
                  {isActive && <span className="nav-icon-flash" aria-hidden="true" />}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}
