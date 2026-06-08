import { NavLink } from 'react-router-dom';

// Icons match the V01 "Nike Sharp" variant on /test/navbars: clean
// line-art (1.8 stroke, round caps/joins), no filled vs outline split,
// 18×18 wrapper inside each tab. The active state communicates via color
// + the top red accent bar — the icon itself doesn't change shape.
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

export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 safe-bottom z-50"
      style={{ background: '#0a0a0a', borderTop: '1px solid rgba(255,255,255,0.05)' }}
    >
      <div className="flex items-stretch h-16">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/app'}
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
  );
}
