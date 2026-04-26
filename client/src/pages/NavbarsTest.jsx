import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Bottom-navbar design sandbox. 10 variants showing different chrome
// treatments for the same 4-tab layout (Workouts / Calendar / Utilities /
// Profile). Each variant is self-contained — local active state only,
// no real routing — so you can pick the elements you like and compose
// the production BottomNav from them.

// Shared icon set — every variant draws from this so only the chrome
// differs between variants. Keeping the SVG outline-stroke style (1.8 weight)
// matches the rest of the app.
const TABS = [
  {
    key: 'workouts',
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
    key: 'calendar',
    label: 'Calendar',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  },
  {
    key: 'utilities',
    label: 'Utilities',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
        <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
      </svg>
    ),
  },
  {
    key: 'profile',
    label: 'Profile',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

// One generic "shell" wrapper for every variant — title, description, then
// the navbar centered on a stage so you see it in context.
function VariantStage({ title, description, children, stageBg = '#0a0a0a' }) {
  return (
    <div className="mb-10">
      <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-wf-red mb-1">{title}</p>
      <p className="text-[11px] text-white/45 mb-3 leading-relaxed">{description}</p>
      <div
        className="relative w-full overflow-hidden"
        style={{
          height: '120px',
          background: stageBg,
          borderRadius: '4px',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

// Hook that gives each variant its own active-tab state.
function useActiveTab(initial = 'workouts') {
  return useState(initial);
}

// ============================================================
// 01 — NIKE SHARP
// ============================================================
function V01_NikeSharp() {
  const [active, setActive] = useActiveTab();
  return (
    <div
      className="absolute bottom-0 left-0 right-0 flex items-stretch"
      style={{ height: 64, background: '#0a0a0a', borderTop: '1px solid rgba(255,255,255,0.05)' }}
    >
      {TABS.map((t) => {
        const on = t.key === active;
        return (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className="flex-1 flex flex-col items-center justify-center gap-1 active:scale-[0.97] transition-transform relative"
            style={{ color: on ? '#ef4444' : 'rgba(255,255,255,0.45)' }}
          >
            {on && (
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2"
                style={{ width: '32px', height: '2px', background: '#ef4444' }}
              />
            )}
            <div style={{ width: 18, height: 18 }}>{t.icon}</div>
            <span className="text-[9px] font-bold uppercase" style={{ letterSpacing: '0.18em' }}>
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// 02 — GLASS PILL (floating, frosted, no labels)
// ============================================================
function V02_GlassPill() {
  const [active, setActive] = useActiveTab();
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
      <div
        className="flex items-center gap-1 p-1.5"
        style={{
          background: 'rgba(255,255,255,0.06)',
          backdropFilter: 'blur(20px) saturate(140%)',
          WebkitBackdropFilter: 'blur(20px) saturate(140%)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '999px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        {TABS.map((t) => {
          const on = t.key === active;
          return (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className="flex items-center justify-center transition-all"
              style={{
                width: 44, height: 44,
                borderRadius: '999px',
                background: on ? '#ef4444' : 'transparent',
                color: on ? '#fff' : 'rgba(255,255,255,0.55)',
              }}
            >
              <div style={{ width: 20, height: 20 }}>{t.icon}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// 03 — MINIMALIST DOT
// ============================================================
function V03_MinimalistDot() {
  const [active, setActive] = useActiveTab();
  return (
    <div className="absolute bottom-0 left-0 right-0 flex items-stretch" style={{ height: 60, background: 'transparent' }}>
      {TABS.map((t) => {
        const on = t.key === active;
        return (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className="flex-1 flex flex-col items-center justify-center relative"
            style={{ color: on ? '#fff' : 'rgba(255,255,255,0.3)' }}
          >
            <div style={{ width: 22, height: 22 }}>{t.icon}</div>
            <span className="text-[10px] mt-1 font-medium">{t.label}</span>
            {on && (
              <div
                className="absolute"
                style={{
                  bottom: 4,
                  width: 4, height: 4, borderRadius: '50%',
                  background: '#ef4444',
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// 04 — NEUMORPHIC
// ============================================================
function V04_Neumorphic() {
  const [active, setActive] = useActiveTab();
  return (
    <div
      className="absolute bottom-0 left-0 right-0 flex items-center justify-around px-4"
      style={{
        height: 72,
        background: '#1a1a1a',
        boxShadow: 'inset 0 8px 16px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(255,255,255,0.04)',
      }}
    >
      {TABS.map((t) => {
        const on = t.key === active;
        return (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className="flex flex-col items-center justify-center gap-1 transition-all"
            style={{
              width: 56, height: 56,
              borderRadius: '14px',
              background: on
                ? 'linear-gradient(145deg, #2a2a2a, #1a1a1a)'
                : 'transparent',
              boxShadow: on
                ? '4px 4px 8px rgba(0,0,0,0.5), -2px -2px 6px rgba(255,255,255,0.03), inset 0 0 12px rgba(239,68,68,0.12)'
                : 'none',
              color: on ? '#ef4444' : 'rgba(255,255,255,0.45)',
            }}
          >
            <div style={{ width: 18, height: 18 }}>{t.icon}</div>
            <span className="text-[9px] font-medium">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// 05 — iOS CLASSIC TAB BAR
// ============================================================
function V05_IOSClassic() {
  const [active, setActive] = useActiveTab();
  return (
    <div
      className="absolute bottom-0 left-0 right-0 flex items-stretch"
      style={{
        height: 70,
        background: 'rgba(20,20,20,0.85)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        borderTop: '0.5px solid rgba(255,255,255,0.18)',
      }}
    >
      {TABS.map((t) => {
        const on = t.key === active;
        return (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 pt-1.5"
            style={{ color: on ? '#3b82f6' : 'rgba(255,255,255,0.55)' }}
          >
            <div style={{ width: 26, height: 26 }}>{t.icon}</div>
            <span className="text-[10px]">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// 06 — BRUTALIST
// ============================================================
function V06_Brutalist() {
  const [active, setActive] = useActiveTab();
  return (
    <div
      className="absolute bottom-0 left-0 right-0 flex items-stretch"
      style={{ height: 68, background: '#000', borderTop: '3px solid #fff' }}
    >
      {TABS.map((t, i) => {
        const on = t.key === active;
        return (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className="flex-1 flex flex-col items-center justify-center gap-1"
            style={{
              background: on ? '#ef4444' : 'transparent',
              color: on ? '#000' : '#fff',
              borderRight: i < TABS.length - 1 ? '2px solid #fff' : 'none',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            }}
          >
            <div style={{ width: 20, height: 20 }}>{t.icon}</div>
            <span className="text-[9px] uppercase font-bold tracking-wider">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// 07 — FLOATING ACTION (center FAB)
// ============================================================
function V07_FloatingAction() {
  const [active, setActive] = useActiveTab();
  // Pull Utilities into the center as the FAB; flank with W/C left and Profile right.
  const order = ['workouts', 'calendar', 'utilities', 'profile'];
  return (
    <div className="absolute bottom-0 left-0 right-0" style={{ height: 80 }}>
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{ height: 64, background: '#0a0a0a', borderTop: '1px solid rgba(255,255,255,0.05)' }}
      />
      <div className="relative flex items-end justify-around h-full pb-2">
        {order.map((k) => {
          const t = TABS.find((x) => x.key === k);
          const isFab = k === 'utilities';
          const on = active === k;
          if (isFab) {
            return (
              <button
                key={k}
                onClick={() => setActive(k)}
                className="flex flex-col items-center -mt-6 active:scale-95 transition-transform"
              >
                <div
                  className="flex items-center justify-center mb-1"
                  style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    boxShadow: '0 6px 18px rgba(239,68,68,0.45), 0 12px 30px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.25)',
                    color: '#fff',
                  }}
                >
                  <div style={{ width: 22, height: 22 }}>{t.icon}</div>
                </div>
                <span className="text-[9px] font-bold uppercase text-white/80" style={{ letterSpacing: '0.15em' }}>
                  {t.label}
                </span>
              </button>
            );
          }
          return (
            <button
              key={k}
              onClick={() => setActive(k)}
              className="flex flex-col items-center justify-center gap-0.5"
              style={{ color: on ? '#ef4444' : 'rgba(255,255,255,0.5)', flex: 1, height: 56 }}
            >
              <div style={{ width: 20, height: 20 }}>{t.icon}</div>
              <span className="text-[9px] font-medium">{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// 08 — UNDERLINE ACTIVE (sliding bar)
// ============================================================
function V08_Underline() {
  const [active, setActive] = useActiveTab();
  const idx = TABS.findIndex((t) => t.key === active);
  return (
    <div
      className="absolute bottom-0 left-0 right-0"
      style={{ height: 64, background: '#0a0a0a', borderTop: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="relative flex items-stretch h-full">
        {TABS.map((t) => {
          const on = t.key === active;
          return (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className="flex-1 flex flex-col items-center justify-center gap-1"
              style={{ color: on ? '#fff' : 'rgba(255,255,255,0.4)' }}
            >
              <div style={{ width: 20, height: 20 }}>{t.icon}</div>
              <span className="text-[10px] font-medium">{t.label}</span>
            </button>
          );
        })}
        {/* Sliding underline */}
        <div
          className="absolute bottom-2"
          style={{
            left: `${(100 / TABS.length) * idx}%`,
            width: `${100 / TABS.length}%`,
            height: '3px',
            transition: 'left 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <div
            style={{
              width: '40px', height: '100%', margin: '0 auto',
              background: 'linear-gradient(90deg, #ef4444, #dc2626)',
              borderRadius: '2px',
              boxShadow: '0 0 12px rgba(239,68,68,0.5)',
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 09 — GRADIENT HIGHLIGHT (full pill behind active tab)
// ============================================================
function V09_GradientHighlight() {
  const [active, setActive] = useActiveTab();
  const idx = TABS.findIndex((t) => t.key === active);
  return (
    <div
      className="absolute bottom-0 left-0 right-0"
      style={{ height: 68, background: '#0f0f0f', borderTop: '1px solid rgba(255,255,255,0.05)' }}
    >
      <div className="relative flex items-stretch h-full px-2">
        {/* Sliding pill behind active tab */}
        <div
          className="absolute top-1/2 -translate-y-1/2"
          style={{
            left: `calc(${(100 / TABS.length) * idx}% + 8px)`,
            width: `calc(${100 / TABS.length}% - 16px)`,
            height: '52px',
            background: 'linear-gradient(135deg, rgba(239,68,68,0.85) 0%, rgba(220,38,38,0.85) 100%)',
            borderRadius: '14px',
            boxShadow: '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.18)',
            transition: 'left 0.32s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
        {TABS.map((t) => {
          const on = t.key === active;
          return (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 relative z-10 transition-colors"
              style={{ color: on ? '#fff' : 'rgba(255,255,255,0.5)' }}
            >
              <div style={{ width: 20, height: 20 }}>{t.icon}</div>
              <span className="text-[9px] font-bold uppercase" style={{ letterSpacing: '0.15em' }}>
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// 10 — MORPHING BLOB (animated SVG dip toward active)
// ============================================================
function V10_MorphingBlob() {
  const [active, setActive] = useActiveTab();
  const idx = TABS.findIndex((t) => t.key === active);
  // Width of the dip carved into the top edge that "lifts" the active icon.
  const stageW = 100; // %
  const tabW = stageW / TABS.length;
  const dipCx = tabW * (idx + 0.5);
  return (
    <div className="absolute bottom-0 left-0 right-0" style={{ height: 80 }}>
      {/* Top dip — pure SVG, animates the curve center between tabs */}
      <svg
        className="absolute bottom-0 left-0 w-full"
        height="80"
        viewBox={`0 0 ${stageW} 80`}
        preserveAspectRatio="none"
        style={{ display: 'block' }}
      >
        <path
          d={`M 0 16
              L ${dipCx - 10} 16
              C ${dipCx - 4} 16, ${dipCx - 6} 4, ${dipCx} 4
              C ${dipCx + 6} 4, ${dipCx + 4} 16, ${dipCx + 10} 16
              L ${stageW} 16
              L ${stageW} 80
              L 0 80 Z`}
          fill="#0a0a0a"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="0.2"
          style={{ transition: 'd 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      </svg>
      <div className="relative flex items-end h-full pb-2">
        {TABS.map((t) => {
          const on = t.key === active;
          return (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className="flex-1 flex flex-col items-center"
              style={{
                color: on ? '#fff' : 'rgba(255,255,255,0.45)',
                transform: on ? 'translateY(-26px)' : 'translateY(0)',
                transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              <div
                className="flex items-center justify-center mb-1"
                style={{
                  width: on ? 44 : 28,
                  height: on ? 44 : 28,
                  borderRadius: '50%',
                  background: on ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'transparent',
                  boxShadow: on ? '0 6px 14px rgba(239,68,68,0.35)' : 'none',
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                <div style={{ width: on ? 22 : 18, height: on ? 22 : 18 }}>{t.icon}</div>
              </div>
              <span
                className="text-[9px] font-bold uppercase"
                style={{
                  letterSpacing: '0.15em',
                  opacity: on ? 0 : 1,
                  transition: 'opacity 0.3s',
                }}
              >
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// PAGE
// ============================================================
export default function NavbarsTest() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-[480px] mx-auto px-4 pt-6 pb-32">
        <button
          onClick={() => navigate('/test')}
          className="flex items-center gap-1 text-[11px] uppercase font-bold mb-6 active:opacity-70"
          style={{ color: 'rgba(239,68,68,0.9)', letterSpacing: '0.2em' }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>

        <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.3em' }}>
          Sandbox
        </p>
        <h1 className="text-3xl font-black text-white tracking-tight mb-2" style={{ fontFamily: 'system-ui' }}>
          BOTTOM NAVBARS
        </h1>
        <p className="text-[12px] text-white/45 mb-8 leading-relaxed">
          10 different bottom-nav treatments using the same 4 tabs. Tap any tab to see active state.
          Mix-and-match the parts you like into the production BottomNav.
        </p>

        <VariantStage
          title="01 — Nike Sharp"
          description="Sharp 2px corners, top red accent bar above active, uppercase tracked labels. Matches the rest of the app's Nike-style cards."
        >
          <V01_NikeSharp />
        </VariantStage>

        <VariantStage
          title="02 — Glass Pill"
          description="Floating frosted-glass pill, no labels. Active tab is a solid red circle. iOS Health / Apple Music vibe."
        >
          <V02_GlassPill />
        </VariantStage>

        <VariantStage
          title="03 — Minimalist Dot"
          description="Transparent background, all white icons + labels, tiny red dot under the active tab. Lets the page bg show through."
        >
          <V03_MinimalistDot />
        </VariantStage>

        <VariantStage
          title="04 — Neumorphic"
          description="Inset shadow on the bar, active tab raises with soft inner shadow + faint red glow. Premium feel; doesn't match the rest of the app's flat aesthetic."
        >
          <V04_Neumorphic />
        </VariantStage>

        <VariantStage
          title="05 — iOS Classic Tab Bar"
          description="System-blurred translucent bar, active in iOS-blue. Familiar to iPhone users. Easy to swap blue for wf-red."
        >
          <V05_IOSClassic />
        </VariantStage>

        <VariantStage
          title="06 — Brutalist"
          description="Hard 3px white top border, monospace labels, full red fill behind active tab, vertical white dividers. Strong opinion — won't blend, makes a statement."
        >
          <V06_Brutalist />
        </VariantStage>

        <VariantStage
          title="07 — Floating Action (center FAB)"
          description="Center tab (Utilities) raises as a circular gradient FAB. Other tabs flat. Common in fitness/social apps; centers attention on a primary action."
        >
          <V07_FloatingAction />
        </VariantStage>

        <VariantStage
          title="08 — Sliding Underline"
          description="Flat bar, red underline pill slides between tabs with cubic-bezier ease. Subtle, modern, one of the most readable patterns at a glance."
        >
          <V08_Underline />
        </VariantStage>

        <VariantStage
          title="09 — Gradient Highlight Pill"
          description="Full red-gradient pill slides behind the active tab with a glow. Bigger commit to the active state than 08 — the entire button cell colors up."
        >
          <V09_GradientHighlight />
        </VariantStage>

        <VariantStage
          title="10 — Morphing Blob"
          description="The top edge of the bar dips into a curve over the active tab, while the active icon lifts up into a floating circle. Highest polish, most animation."
        >
          <V10_MorphingBlob />
        </VariantStage>

        <p className="text-[11px] text-white/35 mt-8 leading-relaxed">
          Tap each navbar to flip the active tab. Pick parts: e.g. <em>shape from 02</em>,
          <em>active treatment from 09</em>, <em>label style from 01</em>.
        </p>
      </div>
    </div>
  );
}
