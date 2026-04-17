import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

// Animated counter hook
function useCountUp(target, duration = 1500, start = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime = null;
    let frame;
    function step(ts) {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * ease));
      if (progress < 1) frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, start]);
  return value;
}

// Sample data
const PROGRAMS = [
  { id: 1, title: 'CHEST\nHYPERTROPHY', subtitle: '6 exercises', duration: '45 min', color: '#ef4444' },
  { id: 2, title: 'BACK &\nTRAPS', subtitle: '7 exercises', duration: '50 min', color: '#3b82f6' },
  { id: 3, title: 'LEG\nDAY', subtitle: '8 exercises', duration: '55 min', color: '#22c55e' },
  { id: 4, title: 'ARMS &\nSHOULDERS', subtitle: '5 exercises', duration: '40 min', color: '#a855f7' },
];

const STATS = [
  { label: 'TOTAL VOLUME', value: 24500, suffix: ' lbs' },
  { label: 'WORKOUTS', value: 47, suffix: '' },
  { label: 'STREAK', value: 12, suffix: ' days' },
];

export default function NikeTestHomepage() {
  const navigate = useNavigate();
  const [countersStarted, setCountersStarted] = useState(false);
  const statsRef = useRef(null);

  // Start counters when stats section scrolls into view
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setCountersStarted(true); },
      { threshold: 0.3 }
    );
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  const vol = useCountUp(STATS[0].value, 1800, countersStarted);
  const workouts = useCountUp(STATS[1].value, 1200, countersStarted);
  const streak = useCountUp(STATS[2].value, 1000, countersStarted);
  const counterValues = [vol, workouts, streak];

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 40%, #111 70%, #0a0a0a 100%)' }}>

      {/* Ambient spotlight glow behind hero */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] pointer-events-none z-0" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 60%)', filter: 'blur(40px)' }} />

      {/* Back button */}
      <div className="relative z-10 px-5 pt-6 pb-2">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-white/50 text-sm font-medium active:opacity-70">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>
      </div>

      {/* ===== 1. BOLD TYPOGRAPHY — Hero Section with spotlight ===== */}
      <div className="relative z-10 px-5 pt-4 pb-10">
        {/* Subtle spotlight behind text */}
        <div className="absolute -top-10 -left-10 w-[300px] h-[300px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.06) 0%, transparent 70%)', filter: 'blur(60px)' }} />
        <p className="text-[11px] text-white/35 uppercase tracking-[0.3em] font-light mb-3">Your Training</p>
        <h1 className="text-[52px] font-black text-white leading-[0.9] tracking-tight mb-4" style={{ fontFamily: 'system-ui', textShadow: '0 4px 30px rgba(0,0,0,0.5)' }}>
          TRAIN<br/>HARDER.
        </h1>
        <p className="text-[15px] text-white/35 font-light leading-relaxed max-w-[280px]">
          Push your limits. Track every rep. Own your progress.
        </p>
      </div>

      {/* ===== 2. HERO — Floating photo with spotlight ===== */}
      <div className="relative z-10 mb-6">
        {/* Studio backdrop gradient */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #1a1a1a 0%, #252525 30%, #2a2a2a 50%, #1a1a1a 80%, #0d0d0d 100%)' }} />
        {/* Spotlight glow behind subject */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 40%, transparent 70%)', filter: 'blur(20px)' }} />
        {/* Secondary warm glow */}
        <div className="absolute top-[30%] left-[20%] w-[300px] h-[300px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.05) 0%, transparent 60%)', filter: 'blur(40px)' }} />

        <div className="relative flex flex-col items-center pt-6 pb-8">
          {/* Program label */}
          <p className="text-[10px] text-white/40 uppercase tracking-[0.3em] font-light mb-2">Featured Program</p>
          <h2 className="text-[26px] font-black text-white leading-[1] tracking-tight mb-6 text-center" style={{ textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}>
            WILL'S HYPERTROPHY
          </h2>

          {/* Floating photo */}
          <div className="relative">
            {/* Floor shadow */}
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-[70%] h-8" style={{ background: 'radial-gradient(ellipse, rgba(0,0,0,0.6) 0%, transparent 70%)', filter: 'blur(8px)' }} />
            <img
              src="/RepLabPhotoShoot.png"
              alt="Will training"
              className="relative w-[280px] max-w-[75vw] object-contain drop-shadow-2xl"
              style={{ filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.5))' }}
            />
          </div>

          {/* Text + CTA below photo */}
          <div className="mt-6 text-center px-8">
            <p className="text-[13px] text-white/40 font-light mb-5">12 weeks. 6 days. Built for growth.</p>
            <button className="px-10 py-3 rounded-full border border-white/70 text-white text-[11px] font-semibold uppercase tracking-[0.2em] active:bg-white/10 transition-colors" style={{ boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>
              Start Program
            </button>
          </div>
        </div>
      </div>

      {/* ===== 5. ANIMATED STAT COUNTERS — Floating cards ===== */}
      <div ref={statsRef} className="relative z-10 px-5 py-10">
        <p className="text-[10px] text-white/25 uppercase tracking-[0.3em] font-light mb-6">Your Stats</p>
        <div className="flex gap-3">
          {STATS.map((stat, i) => (
            <div
              key={stat.label}
              className="flex-1 text-center py-5 px-2"
              style={{
                background: 'linear-gradient(145deg, #1e1e1e 0%, #141414 100%)',
                boxShadow: '0 8px 30px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
                borderRadius: '2px',
              }}
            >
              <div className="text-[28px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', fontVariantNumeric: 'tabular-nums' }}>
                {counterValues[i].toLocaleString()}<span className="text-[12px] font-light text-white/30">{stat.suffix}</span>
              </div>
              <div className="text-[8px] text-white/25 uppercase tracking-[0.25em] font-light mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== 3. HORIZONTAL SCROLL CAROUSEL — 3D floating cards ===== */}
      <div className="relative z-10 py-10">
        {/* Section spotlight */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.04) 0%, transparent 60%)', filter: 'blur(50px)' }} />
        <div className="flex items-end justify-between px-5 mb-6">
          <div>
            <p className="text-[10px] text-white/25 uppercase tracking-[0.3em] font-light mb-1">Programs</p>
            <h3 className="text-[22px] font-black text-white tracking-tight">THIS WEEK</h3>
          </div>
          <button className="text-[11px] text-white/35 uppercase tracking-[0.15em] font-medium active:text-white transition-colors">
            See All
          </button>
        </div>
        <div
          className="flex gap-5 overflow-x-auto scrollbar-hide px-5 snap-x snap-mandatory pb-4"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {PROGRAMS.map((prog) => (
            <div
              key={prog.id}
              className="snap-start shrink-0 w-[190px] cursor-pointer active:scale-[0.96] transition-transform"
              style={{
                background: 'linear-gradient(160deg, #1c1c1c 0%, #111 100%)',
                boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
                borderRadius: '2px',
              }}
            >
              {/* Color accent bar */}
              <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${prog.color}, ${prog.color}80)` }} />
              <div className="p-5 pb-6">
                <h4 className="text-[20px] font-black text-white leading-[1.05] tracking-tight whitespace-pre-line mb-4" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
                  {prog.title}
                </h4>
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-[11px] text-white/30 font-light">{prog.subtitle}</span>
                  <span className="w-px h-3 bg-white/8" />
                  <span className="text-[11px] text-white/30 font-light">{prog.duration}</span>
                </div>
                <button className="w-full py-2.5 rounded-full border border-white/20 text-[10px] text-white/60 uppercase tracking-[0.2em] font-medium active:bg-white/5 transition-colors">
                  Begin
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Subtle divider with glow */}
      <div className="relative mx-5">
        <div className="h-px bg-white/5" />
        <div className="absolute left-1/2 -translate-x-1/2 -top-2 w-32 h-4" style={{ background: 'radial-gradient(ellipse, rgba(255,255,255,0.03) 0%, transparent 70%)' }} />
      </div>

      {/* ===== 4. MONOCHROME WITH ONE ACCENT — Elevated exercise list ===== */}
      <div className="relative z-10 px-5 py-10">
        <p className="text-[10px] text-white/25 uppercase tracking-[0.3em] font-light mb-1">Today</p>
        <h3 className="text-[22px] font-black text-white tracking-tight mb-6">YOUR WORKOUT</h3>

        <div
          className="overflow-hidden"
          style={{
            background: 'linear-gradient(160deg, #1a1a1a 0%, #111 100%)',
            boxShadow: '0 16px 50px rgba(0,0,0,0.5), 0 4px 15px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
            borderRadius: '2px',
          }}
        >
          {['Barbell Bench Press', 'Incline DB Press', 'Cable Flyes', 'Pec Deck', 'Push-Ups to Failure'].map((name, i, arr) => (
            <div
              key={i}
              className="flex items-center justify-between px-5 py-4 active:bg-white/[0.02] transition-colors"
              style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
            >
              <div className="flex items-center gap-4">
                <span className="text-[13px] font-black w-6" style={{ color: i === 0 ? 'rgba(239,68,68,0.7)' : 'rgba(255,255,255,0.1)' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <span className="text-[14px] font-semibold text-white">{name}</span>
                  <div className="text-[11px] text-white/25 font-light mt-0.5">
                    {i < 2 ? '4 sets · 8-10 reps' : i < 4 ? '3 sets · 12-15 reps' : '1 set · max reps'}
                  </div>
                </div>
              </div>
              <svg className="w-4 h-4 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            className="flex-1 py-3.5 rounded-full text-[11px] font-bold uppercase tracking-[0.15em] active:scale-[0.97] transition-all"
            style={{
              background: 'linear-gradient(135deg, #fff 0%, #e0e0e0 100%)',
              color: '#000',
              boxShadow: '0 6px 20px rgba(255,255,255,0.1), 0 2px 6px rgba(255,255,255,0.05)',
            }}
          >
            Start
          </button>
          <button className="flex-1 py-3.5 rounded-full border border-white/15 text-white/50 text-[11px] font-medium uppercase tracking-[0.15em] active:bg-white/5 transition-colors">
            Preview
          </button>
        </div>
      </div>

      {/* Subtle divider */}
      <div className="relative mx-5">
        <div className="h-px bg-white/5" />
      </div>

      {/* ===== PROGRESS GRID — 3D elevated tiles ===== */}
      <div className="relative z-10 px-5 py-10 pb-24">
        {/* Subtle ambient glow */}
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-[500px] h-[300px] pointer-events-none" style={{ background: 'radial-gradient(ellipse, rgba(239,68,68,0.03) 0%, transparent 60%)', filter: 'blur(50px)' }} />
        <p className="text-[10px] text-white/25 uppercase tracking-[0.3em] font-light mb-1">Progress</p>
        <h3 className="text-[22px] font-black text-white tracking-tight mb-8">THIS MONTH</h3>

        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Sessions', value: '18', sub: '+3 vs last month' },
            { label: 'Volume', value: '52.4K', sub: 'lbs lifted' },
            { label: 'Avg Duration', value: '47', sub: 'minutes' },
            { label: 'PRs Hit', value: '4', sub: 'personal records' },
          ].map((item, i) => (
            <div
              key={i}
              className="p-5"
              style={{
                background: 'linear-gradient(155deg, #1e1e1e 0%, #131313 100%)',
                boxShadow: '0 10px 35px rgba(0,0,0,0.5), 0 3px 10px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
                borderRadius: '2px',
              }}
            >
              <div className="text-[30px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
                {item.value}
              </div>
              <div className="text-[9px] text-white/40 uppercase tracking-[0.2em] font-light mt-1">{item.label}</div>
              <div className="text-[9px] text-white/20 font-light mt-0.5">{item.sub}</div>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <button
            className="w-full py-4 rounded-full border border-white/10 text-white/40 text-[11px] font-medium uppercase tracking-[0.2em] active:bg-white/5 transition-colors"
            style={{ boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}
          >
            View Full History
          </button>
        </div>
      </div>
    </div>
  );
}
