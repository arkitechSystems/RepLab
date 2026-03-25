import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function ExampleButton({ label }) {
  return (
    <button className="btn-gradient text-white font-medium px-4 py-2.5 rounded-xl text-sm transition-all shrink-0">
      {label}
    </button>
  );
}

// 1. Bouncing Arrow
function BouncingArrow() {
  return (
    <div className="glass-card rounded-2xl p-5">
      <h3 className="text-sm font-bold text-white mb-1">1. Bouncing Arrow</h3>
      <p className="text-xs text-wf-gray-400 mb-4">A small animated arrow bouncing next to the target button with a tooltip below.</p>
      <div className="flex flex-col items-center gap-2">
        <div className="relative inline-flex items-center gap-3">
          <ExampleButton label="+ Create" />
          <div className="animate-bounce">
            <svg className="w-6 h-6 text-wf-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </div>
        </div>
        <div className="bg-wf-gray-900 border border-white/10 rounded-xl p-3 max-w-[260px]">
          <p className="text-xs text-wf-gray-400">Tap <span className="text-white font-semibold">+ Create</span> to build your own workout.</p>
        </div>
      </div>
    </div>
  );
}

// 2. Glowing Pulse Ring
function GlowingPulseRing() {
  return (
    <div className="glass-card rounded-2xl p-5">
      <h3 className="text-sm font-bold text-white mb-1">2. Glowing Pulse Ring</h3>
      <p className="text-xs text-wf-gray-400 mb-4">A prominent pulsing ring with glow around the target. No line or arrow needed.</p>
      <div className="flex flex-col items-center gap-4">
        <div className="relative inline-flex">
          <ExampleButton label="+ Create" />
          {/* Outer glow ring */}
          <div className="absolute -inset-3 rounded-2xl border-2 border-wf-cyan/60 shadow-[0_0_20px_rgba(0,200,255,0.3),0_0_40px_rgba(0,200,255,0.1)] animate-pulse" />
          {/* Second ring for depth */}
          <div className="absolute -inset-5 rounded-2xl border border-wf-cyan/20 animate-ping" style={{ animationDuration: '2s' }} />
        </div>
        <div className="bg-wf-gray-900 border border-white/10 rounded-xl p-3 max-w-[260px]">
          <p className="text-xs text-wf-gray-400">Tap <span className="text-white font-semibold">+ Create</span> to build your own workout.</p>
        </div>
      </div>
    </div>
  );
}

// 3. Coach Mark Bubble
function CoachMarkBubble() {
  return (
    <div className="glass-card rounded-2xl p-5">
      <h3 className="text-sm font-bold text-white mb-1">3. Coach Mark Bubble</h3>
      <p className="text-xs text-wf-gray-400 mb-4">A speech-bubble tooltip pointing at the button. Standard mobile onboarding pattern.</p>
      <div className="flex flex-col items-center gap-0">
        <div className="inline-flex">
          <ExampleButton label="+ Create" />
        </div>
        {/* Arrow pointing up */}
        <div className="relative mt-0">
          <svg width="20" height="10" viewBox="0 0 20 10" className="mx-auto block">
            <path d="M10 0L20 10H0z" fill="rgb(23,23,23)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          </svg>
        </div>
        <div className="bg-wf-gray-900 border border-white/10 rounded-xl p-3.5 max-w-[280px] shadow-2xl -mt-[1px]">
          <p className="text-sm text-wf-gray-400 leading-relaxed">Tap <span className="text-white font-semibold">+ Create</span> to build your own workout, create a program, or add to an existing one.</p>
          <div className="flex justify-end mt-2">
            <button className="text-xs font-semibold text-wf-cyan active:opacity-70">Got it</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 4. Numbered Badge
function NumberedBadge() {
  return (
    <div className="glass-card rounded-2xl p-5">
      <h3 className="text-sm font-bold text-white mb-1">4. Numbered Badge</h3>
      <p className="text-xs text-wf-gray-400 mb-4">A notification-style badge on the button with a floating step card.</p>
      <div className="flex flex-col items-center gap-3">
        <div className="relative inline-flex">
          <ExampleButton label="+ Create" />
          {/* Badge */}
          <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-wf-cyan/20 flex items-center justify-center shadow-lg border border-wf-cyan/30">
            <span className="text-wf-cyan text-xs font-black">1</span>
          </div>
        </div>
        <div className="bg-wf-gray-900 border border-white/10 rounded-xl p-3.5 max-w-[280px] flex items-start gap-3">
          <div className="w-7 h-7 rounded-full bg-wf-cyan/20 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-wf-cyan text-xs font-black">1</span>
          </div>
          <div>
            <p className="text-xs text-white font-semibold">Step 1</p>
            <p className="text-xs text-wf-gray-400 mt-0.5">Tap here to create a workout.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// 5. Dimmed Overlay with Cutout (non-blocking)
function DimmedOverlay() {
  const btnRef = useRef(null);
  const [rect, setRect] = useState(null);

  useEffect(() => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const container = btnRef.current.closest('.glass-card');
      const cr = container?.getBoundingClientRect() || { left: 0, top: 0 };
      setRect({
        left: r.left - cr.left,
        top: r.top - cr.top,
        width: r.width,
        height: r.height,
      });
    }
  }, []);

  return (
    <div className="glass-card rounded-2xl p-5">
      <h3 className="text-sm font-bold text-white mb-1">5. Dimmed Overlay with Cutout</h3>
      <p className="text-xs text-wf-gray-400 mb-4">Semi-transparent overlay dims everything except the target. Users can still tap through.</p>
      <div className="relative rounded-xl overflow-hidden" style={{ height: 180 }}>
        {/* Fake UI behind */}
        <div className="p-4 flex items-center justify-between">
          <span className="text-sm text-white font-semibold">My Workouts</span>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white/10" />
            <button ref={btnRef} className="btn-gradient text-white font-medium px-4 py-2.5 rounded-xl text-sm">+ Create</button>
          </div>
        </div>
        <div className="px-4 space-y-2">
          <div className="h-16 rounded-xl bg-white/5" />
          <div className="h-16 rounded-xl bg-white/5" />
        </div>
        {/* Dimmed overlay */}
        {rect && (
          <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
            <svg className="w-full h-full">
              <defs>
                <mask id="dim-mask">
                  <rect x="0" y="0" width="100%" height="100%" fill="white" />
                  <rect x={rect.left - 6} y={rect.top - 6} width={rect.width + 12} height={rect.height + 12} rx="14" fill="black" />
                </mask>
              </defs>
              <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.7)" mask="url(#dim-mask)" />
            </svg>
          </div>
        )}
        {/* Tooltip below button */}
        {rect && (
          <div
            className="absolute bg-wf-gray-900 border border-white/10 rounded-xl p-3 max-w-[240px] shadow-2xl"
            style={{ top: rect.top + rect.height + 12, right: 16, pointerEvents: 'none' }}
          >
            <p className="text-xs text-wf-gray-400">Tap <span className="text-white font-semibold">+ Create</span> to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// 6. Hand Pointer Animation
function HandPointer() {
  return (
    <div className="glass-card rounded-2xl p-5">
      <h3 className="text-sm font-bold text-white mb-1">6. Hand Pointer Animation</h3>
      <p className="text-xs text-wf-gray-400 mb-4">An animated hand/finger that repeatedly taps the button.</p>
      <div className="flex flex-col items-center gap-3">
        <div className="relative inline-flex">
          <ExampleButton label="+ Create" />
          {/* Animated hand */}
          <div className="absolute -bottom-6 -right-2" style={{ animation: 'handTap 1.5s ease-in-out infinite' }}>
            <svg className="w-8 h-8 text-white drop-shadow-lg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6.5 1A4.5 4.5 0 0 0 2 5.5V6a1 1 0 0 0 2 0v-.5A2.5 2.5 0 0 1 6.5 3h.5a1 1 0 0 0 0-2h-.5ZM9 5.5A3.5 3.5 0 0 1 12.5 2a1 1 0 0 1 1 1v7.038a1 1 0 0 1 2 0V8a1 1 0 0 1 2 0v4.038a1 1 0 0 1 2 0V10a1 1 0 1 1 2 0v7a7 7 0 0 1-7 7h-1.5A6.5 6.5 0 0 1 7.5 17.5V10a1 1 0 0 1 2 0v.038a1 1 0 0 1 2 0V3a1 1 0 0 1 1-1A3.5 3.5 0 0 1 16 5.5v.038" />
            </svg>
          </div>
        </div>
        <div className="bg-wf-gray-900 border border-white/10 rounded-xl p-3 max-w-[260px] mt-4">
          <p className="text-xs text-wf-gray-400">Tap <span className="text-white font-semibold">+ Create</span> to build your own workout.</p>
        </div>
      </div>
      <style>{`
        @keyframes handTap {
          0%, 100% { transform: translateY(0) scale(1); opacity: 1; }
          50% { transform: translateY(-8px) scale(0.95); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}

export default function TutorialTest() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black pb-24">
      <div className="px-4 pt-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-wf-red text-sm font-medium mb-4 active:opacity-70">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>

        <h1 className="text-2xl font-black text-white mb-2">Tutorial Pointer Styles</h1>
        <p className="text-sm text-wf-gray-400 mb-6">Six different approaches for directing users to a button without using a full spotlight overlay.</p>

        <div className="space-y-4">
          <BouncingArrow />
          <GlowingPulseRing />
          <CoachMarkBubble />
          <NumberedBadge />
          <DimmedOverlay />
          <HandPointer />
        </div>
      </div>
    </div>
  );
}
