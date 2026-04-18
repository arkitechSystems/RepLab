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

// Nike-style floating card wrapper
function NikeCard({ children, className = '', style = {}, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden ${onClick ? 'cursor-pointer active:scale-[0.97] transition-transform' : ''} ${className}`}
      style={{
        background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
        borderRadius: '2px',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default function NewHomepage() {
  const navigate = useNavigate();
  const [countersStarted, setCountersStarted] = useState(false);
  const statsRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setCountersStarted(true); },
      { threshold: 0.3 }
    );
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  // Sample stat values (would come from API in real version)
  const streak = useCountUp(12, 1000, countersStarted);
  const totalWorkouts = useCountUp(47, 1200, countersStarted);
  const monthWorkouts = useCountUp(8, 800, countersStarted);

  return (
    <div className="min-h-screen pb-24" style={{ background: 'linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 40%, #111 70%, #0a0a0a 100%)' }}>

      {/* Ambient spotlight */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] pointer-events-none z-0" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 60%)', filter: 'blur(40px)' }} />

      {/* Back button */}
      <div className="relative z-10 px-5 pt-6 pb-2">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-white/50 text-sm font-medium active:opacity-70">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>
      </div>

      {/* ===== YOUR NEXT WORKOUT ===== */}
      <div className="relative z-10 mx-4 mt-2 mb-6">
        <NikeCard>
          {/* Red accent line */}
          <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #ef4444, #ef444440)' }} />
          {/* Accent spotlight */}
          <div className="absolute -top-10 -right-10 w-[250px] h-[250px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 60%)', filter: 'blur(40px)' }} />

          <div className="relative p-6">
            <p className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-light mb-2">Up Next</p>
            <h2 className="text-[28px] font-black text-white leading-[0.95] tracking-tight mb-1" style={{ fontFamily: 'system-ui' }}>
              YOUR NEXT<br/>WORKOUT
            </h2>

            {/* Workout info */}
            <div className="mt-4 mb-5">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-[15px] font-semibold text-white">Chest</span>
                <span className="w-px h-3.5 bg-white/10" />
                <span className="text-[13px] text-white/35 font-light">Today</span>
              </div>
              <p className="text-[12px] text-white/25 font-light">Will's Hypertrophy Program — Week 3</p>
            </div>

            {/* Exercise preview */}
            <div className="mb-6">
              {['Barbell Bench', 'DB Incline Press', 'Cable Flyes'].map((name, i) => (
                <div key={i} className="flex items-center gap-3 py-2" style={{ borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <span className="text-[11px] font-black w-5" style={{ color: 'rgba(239,68,68,0.5)' }}>{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-[13px] text-white/60 font-light">{name}</span>
                </div>
              ))}
              <div className="pt-1">
                <span className="text-[11px] text-white/20 font-light">+4 more exercises</span>
              </div>
            </div>

            {/* CTA */}
            <div className="flex gap-3">
              <button
                className="flex-1 py-3.5 rounded-full text-[11px] font-bold uppercase tracking-[0.15em] active:scale-[0.97] transition-all"
                style={{ background: 'linear-gradient(135deg, #fff 0%, #e0e0e0 100%)', color: '#000', boxShadow: '0 6px 20px rgba(255,255,255,0.1)' }}
              >
                Start Now
              </button>
              <button className="flex-1 py-3.5 rounded-full border border-white/15 text-white/50 text-[11px] font-medium uppercase tracking-[0.15em] active:bg-white/5 transition-colors">
                Preview
              </button>
            </div>
          </div>
        </NikeCard>
      </div>

      {/* ===== STATS ROW ===== */}
      <div ref={statsRef} className="relative z-10 px-4 mb-6">
        <div className="flex gap-3">
          {[
            { value: streak, label: 'DAY STREAK', suffix: '', color: 'rgba(249,115,22,0.6)' },
            { value: totalWorkouts, label: 'TOTAL', suffix: '', color: 'rgba(239,68,68,0.6)' },
            { value: monthWorkouts, label: 'THIS MONTH', suffix: '', color: 'rgba(34,197,94,0.6)' },
          ].map((stat, i) => (
            <NikeCard key={i} className="flex-1 text-center py-4 px-2">
              <div className="text-[26px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', fontVariantNumeric: 'tabular-nums' }}>
                {stat.value}
              </div>
              <div className="text-[7px] uppercase tracking-[0.25em] font-light mt-1" style={{ color: stat.color }}>{stat.label}</div>
            </NikeCard>
          ))}
        </div>
      </div>

      {/* ===== FEATURED WORKOUTS ===== */}
      <div className="relative z-10 mx-4 mb-6">
        <NikeCard onClick={() => navigate('/featured-session')}>
          <div className="relative">
            <video
              ref={(el) => { if (el) { el.currentTime = 10; el.play().catch(() => {}); } }}
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay loop muted playsInline preload="auto"
              src="/Gym cinematic promotion video.mp4"
            />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.8) 100%)' }} />
            <div className="relative p-6" style={{ minHeight: '140px' }}>
              <p className="text-[10px] text-white/40 uppercase tracking-[0.3em] font-light mb-2">Featured</p>
              <h3 className="text-[22px] font-black text-white tracking-tight leading-[1]">FEATURED<br/>WORKOUTS</h3>
              <p className="text-[11px] text-white/35 font-light mt-2">Guided sessions with custom set logging</p>
              <div className="flex items-center gap-1 mt-3">
                <span className="text-[10px] text-white/40 font-light">Explore</span>
                <svg className="w-3 h-3 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </div>
          </div>
        </NikeCard>
      </div>

      {/* ===== BROWSE LIBRARY + MY WORKOUTS — side by side ===== */}
      <div className="relative z-10 px-4 mb-6 flex gap-3">
        {/* Browse Library */}
        <NikeCard className="flex-1" onClick={() => {}}>
          <div className="h-[2px]" style={{ background: 'linear-gradient(90deg, #ef4444, transparent)' }} />
          <div className="p-5">
            <div className="text-[32px] font-black text-white tracking-tight leading-[1]" style={{ fontFamily: 'system-ui' }}>4</div>
            <div className="text-[8px] text-white/25 uppercase tracking-[0.25em] font-light mt-1">Programs</div>
            <div className="mt-4 mb-3 h-px bg-white/5" />
            <p className="text-[12px] font-semibold text-white uppercase tracking-[0.1em]">Browse Library</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {['Hypertrophy', 'Strength'].map((t) => (
                <span key={t} className="text-[8px] text-wf-red/60 uppercase tracking-[0.2em] font-medium">{t}</span>
              ))}
            </div>
            <div className="flex items-center gap-1 mt-3">
              <span className="text-[10px] text-white/30 font-light">View</span>
              <svg className="w-3 h-3 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </div>
        </NikeCard>

        {/* My Workouts */}
        <NikeCard className="flex-1" onClick={() => {}}>
          <div className="h-[2px]" style={{ background: 'linear-gradient(90deg, #3b82f6, transparent)' }} />
          <div className="p-5">
            <div className="text-[32px] font-black text-white tracking-tight leading-[1]" style={{ fontFamily: 'system-ui' }}>2</div>
            <div className="text-[8px] text-white/25 uppercase tracking-[0.25em] font-light mt-1">Programs</div>
            <div className="mt-4 mb-3 h-px bg-white/5" />
            <p className="text-[12px] font-semibold text-white uppercase tracking-[0.1em]">My Workouts</p>
            <p className="text-[10px] text-white/20 font-light mt-2">Your custom programs</p>
            <div className="flex items-center gap-1 mt-3">
              <span className="text-[10px] text-white/30 font-light">View</span>
              <svg className="w-3 h-3 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </div>
        </NikeCard>
      </div>

      {/* Subtle divider */}
      <div className="relative mx-5 my-2">
        <div className="h-px bg-white/5" />
        <div className="absolute left-1/2 -translate-x-1/2 -top-2 w-32 h-4" style={{ background: 'radial-gradient(ellipse, rgba(255,255,255,0.03) 0%, transparent 70%)' }} />
      </div>

      {/* ===== PROGRAM CAROUSEL ===== */}
      <div className="relative z-10 py-8">
        <div className="flex items-end justify-between px-5 mb-5">
          <div>
            <p className="text-[10px] text-white/25 uppercase tracking-[0.3em] font-light mb-1">Programs</p>
            <h3 className="text-[22px] font-black text-white tracking-tight">THIS WEEK</h3>
          </div>
          <button className="text-[11px] text-white/35 uppercase tracking-[0.15em] font-medium active:text-white transition-colors">
            See All
          </button>
        </div>
        <div className="flex gap-4 overflow-x-auto scrollbar-hide px-5 snap-x snap-mandatory pb-2" style={{ WebkitOverflowScrolling: 'touch' }}>
          {[
            { title: 'CHEST', sub: '7 exercises', dur: '45 min', color: '#ef4444' },
            { title: 'BIS / RDs', sub: '6 exercises', dur: '40 min', color: '#f59e0b' },
            { title: 'QUADS', sub: '8 exercises', dur: '55 min', color: '#22c55e' },
            { title: 'TRIS /\nSHOULDERS', sub: '5 exercises', dur: '40 min', color: '#3b82f6' },
            { title: 'BACK /\nTRAPS', sub: '7 exercises', dur: '50 min', color: '#a855f7' },
            { title: 'GLUTES /\nHAMS', sub: '6 exercises', dur: '45 min', color: '#ec4899' },
          ].map((prog, i) => (
            <NikeCard key={i} className="snap-start shrink-0 w-[170px]">
              <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${prog.color}, ${prog.color}40)` }} />
              <div className="p-4 pb-5">
                <h4 className="text-[18px] font-black text-white leading-[1.05] tracking-tight whitespace-pre-line mb-3">
                  {prog.title}
                </h4>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[10px] text-white/30 font-light">{prog.sub}</span>
                  <span className="w-px h-2.5 bg-white/8" />
                  <span className="text-[10px] text-white/30 font-light">{prog.dur}</span>
                </div>
                <button className="w-full py-2 rounded-full border border-white/15 text-[9px] text-white/50 uppercase tracking-[0.2em] font-medium active:bg-white/5 transition-colors">
                  Begin
                </button>
              </div>
            </NikeCard>
          ))}
        </div>
      </div>

      {/* Subtle divider */}
      <div className="relative mx-5 my-2">
        <div className="h-px bg-white/5" />
      </div>

      {/* ===== HERO — Photo section ===== */}
      <div className="relative z-10 my-8">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #1a1a1a 0%, #252525 30%, #2a2a2a 50%, #1a1a1a 80%, #0d0d0d 100%)' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 40%, transparent 70%)', filter: 'blur(20px)' }} />
        <div className="relative flex flex-col items-center pt-6 pb-8">
          <p className="text-[10px] text-white/40 uppercase tracking-[0.3em] font-light mb-2">Featured Program</p>
          <h2 className="text-[24px] font-black text-white leading-[1] tracking-tight mb-5 text-center">WILL'S HYPERTROPHY</h2>
          <div className="relative">
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-[70%] h-8" style={{ background: 'radial-gradient(ellipse, rgba(0,0,0,0.6) 0%, transparent 70%)', filter: 'blur(8px)' }} />
            <img src="/RepLabPhotoShoot.png" alt="Will training" className="relative w-[260px] max-w-[70vw] object-contain" style={{ filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.5))' }} />
          </div>
          <div className="mt-6 text-center px-8">
            <p className="text-[12px] text-white/35 font-light mb-4">12 weeks. 6 days. Built for growth.</p>
            <button className="px-10 py-3 rounded-full border border-white/60 text-white text-[11px] font-semibold uppercase tracking-[0.2em] active:bg-white/10 transition-colors" style={{ boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>
              Start Program
            </button>
          </div>
        </div>
      </div>

      {/* Subtle divider */}
      <div className="relative mx-5 my-2">
        <div className="h-px bg-white/5" />
      </div>

      {/* ===== TUTORIAL ===== */}
      <div className="relative z-10 mx-4 my-6">
        <NikeCard onClick={() => {}}>
          <div className="h-[2px]" style={{ background: 'linear-gradient(90deg, #06b6d4, transparent)' }} />
          <div className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)' }}>
              <svg className="w-5 h-5" style={{ color: '#06b6d4' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-white">Tutorial</p>
              <p className="text-[11px] text-white/30 font-light mt-0.5">Step-by-step walkthrough</p>
            </div>
            <svg className="w-4 h-4 text-white/20 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </div>
        </NikeCard>
      </div>

      {/* ===== CHALLENGES ===== */}
      <div className="relative z-10 mx-4 mb-6">
        <NikeCard onClick={() => {}}>
          <div className="h-[2px]" style={{ background: 'linear-gradient(90deg, #f97316, transparent)' }} />
          <div className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)' }}>
              <svg className="w-5 h-5" style={{ color: '#f97316' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.996.436-1.75 1.56-1.75 2.764 0 2.322 2.5 4 5.25 4s5.25-1.678 5.25-4c0-1.204-.754-2.328-1.75-2.764M12 2.25v2.25" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-white">Challenges</p>
              <p className="text-[11px] text-white/30 font-light mt-0.5">Compete and earn badges</p>
            </div>
            <svg className="w-4 h-4 text-white/20 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </div>
        </NikeCard>
      </div>

      {/* ===== PR TICKER ===== */}
      <div className="relative z-10 mx-4 mb-6">
        <NikeCard>
          <div className="p-4 overflow-hidden">
            <p className="text-[9px] text-white/20 uppercase tracking-[0.25em] font-light mb-3">Personal Records</p>
            <div className="overflow-hidden whitespace-nowrap">
              <div className="inline-block" style={{ animation: 'prTicker 20s linear infinite', fontSize: '12px' }}>
                {['Chest PR — Bench Press — 225 LBS x 8', 'Back PR — Barbell Row — 185 LBS x 10', 'Legs PR — Squat — 275 LBS x 6', 'Shoulders PR — OHP — 135 LBS x 8'].map((pr, i) => (
                  <span key={i}>
                    <span className="text-white/50 font-light">{pr}</span>
                    <span className="text-white/10 mx-4">|</span>
                  </span>
                ))}
                {['Chest PR — Bench Press — 225 LBS x 8', 'Back PR — Barbell Row — 185 LBS x 10', 'Legs PR — Squat — 275 LBS x 6', 'Shoulders PR — OHP — 135 LBS x 8'].map((pr, i) => (
                  <span key={`d-${i}`}>
                    <span className="text-white/50 font-light">{pr}</span>
                    <span className="text-white/10 mx-4">|</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </NikeCard>
      </div>

      {/* Subtle divider */}
      <div className="relative mx-5 my-2">
        <div className="h-px bg-white/5" />
      </div>

      {/* ===== LAST SESSION ===== */}
      <div className="relative z-10 mx-4 my-6">
        <p className="text-[10px] text-white/25 uppercase tracking-[0.3em] font-light mb-3 px-1">Last Session</p>
        <NikeCard>
          <div className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[14px] font-semibold text-white">Back / Traps</p>
              <p className="text-[11px] text-white/25 font-light mt-1">Yesterday · 52 min · 18,400 lbs volume</p>
            </div>
            <svg className="w-4 h-4 text-white/20 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </div>
        </NikeCard>
      </div>
    </div>
  );
}
