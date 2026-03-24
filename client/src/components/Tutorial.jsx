import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTutorial } from '../context/TutorialContext';
import { getStepsForPhase } from '../data/tutorialSteps';

export default function Tutorial() {
  const { tutorial, startTutorial, advanceTutorial, skipTutorial } = useTutorial();
  const navigate = useNavigate();
  const [targetRect, setTargetRect] = useState(null);
  const [extraRects, setExtraRects] = useState([]);
  const overlayRef = useRef(null);

  const steps = tutorial.phase ? getStepsForPhase(tutorial.phase) : [];
  const current = steps[tutorial.stepIndex] || null;

  const handleSkip = useCallback(() => {
    skipTutorial();
    navigate('/workouts');
  }, [skipTutorial, navigate]);

  // If no phase yet, show choice screen
  const showChoice = tutorial.active && !tutorial.phase;
  // If phase is set, show spotlight steps
  const showSpotlight = tutorial.active && tutorial.phase && current;

  const measureTarget = useCallback(() => {
    if (!current || !current.target) {
      setTargetRect(null);
      setExtraRects([]);
      return;
    }
    const el = document.querySelector(current.target);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Measure after scroll settles
      requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);
        // Measure extra targets
        const extras = (current.extraTargets || [])
          .map((sel) => document.querySelector(sel))
          .filter(Boolean)
          .map((e) => e.getBoundingClientRect());
        setExtraRects(extras);
      });
    } else {
      setTargetRect(null);
      setExtraRects([]);
    }
  }, [current]);

  useEffect(() => {
    if (!showSpotlight) return;
    // Scroll to top and delay measure to let DOM settle after navigation
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const timer = setTimeout(measureTarget, 400);
    const handler = () => requestAnimationFrame(measureTarget);
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [measureTarget, showSpotlight]);

  // Listen for tutorial action completions
  useEffect(() => {
    if (!current || !current.waitFor) return;
    const waitForList = Array.isArray(current.waitFor) ? current.waitFor : [current.waitFor];
    const handler = (e) => {
      if (waitForList.includes(e.detail)) {
        // Small delay so the UI can update before we advance
        setTimeout(advanceTutorial, 300);
      }
    };
    window.addEventListener('tutorial-action', handler);
    return () => window.removeEventListener('tutorial-action', handler);
  }, [current, advanceTutorial]);

  // Tutorial complete — all steps done
  useEffect(() => {
    if (tutorial.active && tutorial.phase && steps.length > 0 && tutorial.stepIndex >= steps.length) {
      skipTutorial();
    }
  }, [tutorial, steps, skipTutorial]);

  if (!tutorial.active) return null;

  // ─── Choice Screen ───
  if (showChoice) {
    return createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center px-6" style={{ pointerEvents: 'auto' }}>
        <div className="absolute inset-0 bg-black/90" onClick={handleSkip} />
        <div className="relative w-full max-w-sm">
          <div className="flex justify-center mb-5">
            <div className="w-14 h-14 rounded-2xl bg-wf-cyan/10 border border-wf-cyan/20 flex items-center justify-center">
              <svg className="w-7 h-7 text-wf-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59" />
              </svg>
            </div>
          </div>

          <h2 className="text-xl font-black text-white text-center mb-2">How would you like to get started?</h2>
          <p className="text-sm text-wf-gray-400 text-center leading-relaxed mb-6">
            You can follow a pre-built program designed by trainers, or create your own custom workout from scratch.
          </p>

          <div className="space-y-3">
            {/* Follow a Pre-Built Program */}
            <button
              onClick={() => startTutorial('browse')}
              className="w-full glass-card rounded-2xl p-4 flex items-center gap-4 active:scale-[0.98] transition-transform cursor-pointer border border-wf-green/20"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-wf-green/10">
                <svg className="w-5 h-5 text-wf-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
              </div>
              <div className="flex-1 text-left">
                <span className="text-sm font-semibold text-white">Follow a Pre-Built Program</span>
                <p className="text-[11px] text-wf-gray-500 mt-0.5">Push Pull Legs, Upper/Lower, Bro Split, and more</p>
              </div>
              <svg className="w-4 h-4 text-wf-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>

            {/* Create My Own Workout — disabled for now */}
            <button
              className="w-full glass-card rounded-2xl p-4 flex items-center gap-4 opacity-40 cursor-default"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-wf-red/10">
                <svg className="w-5 h-5 text-wf-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
              <div className="flex-1 text-left">
                <span className="text-sm font-semibold text-white">Create My Own Workout</span>
                <p className="text-[11px] text-wf-gray-500 mt-0.5">Build a workout tailored to your goals</p>
              </div>
              <svg className="w-4 h-4 text-wf-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>

          <div className="flex justify-center mt-6">
            <button onClick={handleSkip} className="text-sm font-semibold text-white/70 bg-white/10 hover:bg-white/15 active:bg-white/20 transition-colors py-2.5 px-6 rounded-xl border border-white/10">
              Skip tutorial
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // ─── Spotlight Steps ───
  if (!showSpotlight) return null;

  const padding = 8;

  let tooltipStyle = {};
  let arrowStyle = {};
  if (targetRect) {
    const gap = 16;
    if (current.position === 'bottom') {
      tooltipStyle = {
        top: targetRect.bottom + gap + padding,
        left: '50%',
        transform: 'translateX(-50%)',
      };
      arrowStyle = {
        top: targetRect.bottom + padding + 4,
        left: targetRect.left + targetRect.width / 2,
        transform: 'translateX(-50%)',
      };
    } else {
      tooltipStyle = {
        bottom: window.innerHeight - targetRect.top + gap + padding,
        left: '50%',
        transform: 'translateX(-50%)',
      };
      arrowStyle = {
        top: targetRect.top - padding - 4,
        left: targetRect.left + targetRect.width / 2,
        transform: 'translateX(-50%) translateY(-100%)',
      };
    }
  }

  // For action steps with allowInteraction, we let clicks through to the target
  const cutoutClickable = current.allowInteraction && targetRect;

  // Build clip-path for the click blocker: covers everything EXCEPT interactive cutouts
  const clickableRects = cutoutClickable
    ? [targetRect, ...extraRects].filter(Boolean)
    : [];

  // evenodd clip-path: outer rect covers viewport, inner rects punch holes
  let blockerClipPath = undefined;
  if (clickableRects.length > 0) {
    const W = window.innerWidth;
    const H = window.innerHeight;
    // Outer boundary (clockwise)
    let path = `M 0 0 L ${W} 0 L ${W} ${H} L 0 ${H} Z`;
    // Each hole (counter-clockwise for evenodd subtraction)
    clickableRects.forEach((r) => {
      const x1 = r.left - padding, y1 = r.top - padding;
      const x2 = r.left + r.width + padding, y2 = r.top + r.height + padding;
      path += ` M ${x1} ${y1} L ${x1} ${y2} L ${x2} ${y2} L ${x2} ${y1} Z`;
    });
    blockerClipPath = `path(evenodd, '${path}')`;
  }

  return createPortal(
    <div ref={overlayRef} className="fixed inset-0 z-[100]" style={{ pointerEvents: 'none' }}>
      {/* Visual dark overlay with cutout (SVG) — pointer-events: none, purely visual */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
        <defs>
          <mask id="tutorial-visual-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - padding}
                y={targetRect.top - padding}
                width={targetRect.width + padding * 2}
                height={targetRect.height + padding * 2}
                rx="16"
                fill="black"
              />
            )}
            {extraRects.map((r, i) => (
              <rect
                key={i}
                x={r.left - padding}
                y={r.top - padding}
                width={r.width + padding * 2}
                height={r.height + padding * 2}
                rx="16"
                fill="black"
              />
            ))}
          </mask>
        </defs>
        <rect
          x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.85)"
          mask="url(#tutorial-visual-mask)"
        />
      </svg>

      {/* Full-screen click blocker with holes punched for interactive targets */}
      <div
        className="absolute inset-0"
        style={{
          pointerEvents: 'auto',
          clipPath: blockerClipPath,
        }}
      />

      {/* Spotlight border glow */}
      {targetRect && (
        <div
          className="absolute rounded-2xl border-2 border-wf-cyan/60 shadow-[0_0_20px_rgba(0,200,255,0.15)]"
          style={{
            top: targetRect.top - padding,
            left: targetRect.left - padding,
            width: targetRect.width + padding * 2,
            height: targetRect.height + padding * 2,
            pointerEvents: 'none',
            transition: 'all 0.3s ease',
          }}
        />
      )}
      {/* Extra target glow borders */}
      {extraRects.map((r, i) => (
        <div
          key={i}
          className="absolute rounded-2xl border-2 border-wf-cyan/60 shadow-[0_0_20px_rgba(0,200,255,0.15)]"
          style={{
            top: r.top - padding,
            left: r.left - padding,
            width: r.width + padding * 2,
            height: r.height + padding * 2,
            pointerEvents: 'none',
            transition: 'all 0.3s ease',
          }}
        />
      ))}

      {/* Arrow */}
      {targetRect && (
        <div
          className="absolute"
          style={{ ...arrowStyle, pointerEvents: 'none', transition: 'all 0.3s ease' }}
        >
          <svg width="20" height="12" viewBox="0 0 20 12">
            {current.position === 'bottom' ? (
              <path d="M10 0L20 12H0z" fill="rgb(23,23,23)" />
            ) : (
              <path d="M10 12L0 0h20z" fill="rgb(23,23,23)" />
            )}
          </svg>
        </div>
      )}

      {/* Tooltip */}
      {targetRect && (
        <div
          className="absolute w-[calc(100%-48px)] max-w-sm bg-wf-gray-900 border border-white/10 rounded-2xl p-5 shadow-2xl"
          style={{ ...tooltipStyle, transition: 'all 0.3s ease', pointerEvents: 'auto' }}
        >
          {/* Step indicator */}
          <div className="flex items-center gap-1.5 mb-3">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all ${
                  i === tutorial.stepIndex ? 'w-6 bg-wf-cyan' : i < tutorial.stepIndex ? 'w-3 bg-wf-cyan/40' : 'w-3 bg-white/10'
                }`}
              />
            ))}
          </div>

          <h3 className="text-base font-bold text-white mb-1">{current.title}</h3>
          <p className="text-sm text-wf-gray-400 leading-relaxed">{current.description}</p>

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-3 mt-4">
            {!current.waitFor && (
              <button
                onClick={advanceTutorial}
                className="text-sm font-semibold text-white btn-gradient py-2 px-5 rounded-xl active:scale-[0.97] transition-transform"
              >
                Got it
              </button>
            )}
            <button
              onClick={handleSkip}
              className="text-sm font-semibold text-white/70 bg-white/10 hover:bg-white/15 active:bg-white/20 transition-colors py-2 px-5 rounded-xl border border-white/10"
            >
              Skip tutorial
            </button>
          </div>
        </div>
      )}

      {/* Waiting state — target not found yet */}
      {!targetRect && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ pointerEvents: 'auto' }}>
          <div className="bg-wf-gray-900 border border-white/10 rounded-2xl p-5 shadow-2xl max-w-sm w-[calc(100%-48px)]">
            <div className="flex items-center gap-3 mb-3">
              <svg className="w-5 h-5 text-wf-cyan animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm text-wf-gray-400">Loading next step...</p>
            </div>
            <button onClick={handleSkip} className="text-sm font-semibold text-white/70 bg-white/10 hover:bg-white/15 active:bg-white/20 transition-colors py-2 px-5 rounded-xl border border-white/10">
              Skip tutorial
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
