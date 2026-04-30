import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Shared breathing-phase hook (drives organic blob, aurora pulse, stripe shimmer)
function useBreath(speed = 80) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPhase((p) => (p + 1) % 1000), speed);
    return () => clearInterval(id);
  }, [speed]);
  return phase;
}

function Section({ index, title, tag, children }) {
  return (
    <div className="mb-10">
      <div className="px-4 mb-3">
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] text-wf-red font-mono">0{index}</span>
          <h2 className="text-white text-lg font-black tracking-tight">{title}</h2>
          <span className="text-[10px] text-wf-gray-500 uppercase tracking-[0.2em]">{tag}</span>
        </div>
      </div>
      <div className="rounded-3xl overflow-hidden mx-2" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
        {children}
      </div>
    </div>
  );
}

/* ================================================================
   1. NIKE KNOCKOUT — Massive type, asymmetric, underline inputs
   ================================================================ */
function NikeKnockout() {
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  return (
    <div className="relative px-6 py-10" style={{ background: '#0a0a0a', minHeight: 640 }}>
      <div className="absolute top-6 right-6 text-[10px] tracking-[0.3em] text-wf-red font-black uppercase">REPLAB</div>
      <div className="absolute -top-8 -left-6 w-[260px] h-[260px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.18) 0%, transparent 65%)', filter: 'blur(40px)' }} />

      <div className="relative pt-8">
        <p className="text-[11px] text-white/40 uppercase tracking-[0.4em] font-light mb-3">Welcome back</p>
        <h1 className="text-white font-black leading-[0.85] tracking-tighter"
          style={{ fontSize: 76, fontFamily: 'system-ui' }}>
          SIGN<br/>IN<span className="text-wf-red">.</span>
        </h1>
        <p className="text-white/40 text-[13px] mt-4 font-light max-w-[240px]">
          Push your limits. Track every rep. Own your progress.
        </p>
      </div>

      <div className="relative mt-12 space-y-7">
        <div>
          <label className="text-[10px] text-white/40 uppercase tracking-[0.3em] block mb-2">Email or Phone</label>
          <input
            type="text" value={id} onChange={(e) => setId(e.target.value)}
            placeholder="you@replab.com"
            className="w-full bg-transparent text-white text-[16px] font-light pb-3 focus:outline-none placeholder:text-white/20"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}
          />
        </div>
        <div>
          <label className="text-[10px] text-white/40 uppercase tracking-[0.3em] block mb-2">Password</label>
          <input
            type="password" value={pw} onChange={(e) => setPw(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-transparent text-white text-[16px] font-light pb-3 focus:outline-none placeholder:text-white/20"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}
          />
        </div>
        <div className="text-right">
          <span className="text-[11px] text-white/40 uppercase tracking-[0.2em]">Forgot password</span>
        </div>

        <button className="w-full text-white font-black uppercase py-4 text-[13px] active:scale-[0.98] transition-transform"
          style={{ background: '#EF4444', borderRadius: 2, letterSpacing: '0.25em',
            boxShadow: '0 8px 30px rgba(239,68,68,0.35)' }}>
          Sign In →
        </button>

        <p className="text-center text-[11px] text-white/40 uppercase tracking-[0.2em]">
          New here? <span className="text-wf-red font-black">JOIN</span>
        </p>
      </div>
    </div>
  );
}

/* ================================================================
   2. ORGANIC BLOB — Pulsing morphing red blob + glass card
   DYNAMIC
   ================================================================ */
function OrganicBlob() {
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const phase = useBreath(70);
  const t = phase * 0.06;

  return (
    <div className="relative flex items-center justify-center px-6 py-12 overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #1a0606 0%, #050505 70%)', minHeight: 640 }}>

      {/* Big morphing organic blob */}
      <div className="absolute pointer-events-none"
        style={{
          top: '50%', left: '50%', width: 460, height: 460,
          transform: `translate(-50%, -50%) scale(${1 + Math.sin(t) * 0.08}) rotate(${Math.sin(t * 0.5) * 25}deg)`,
          borderRadius: `${50 + Math.sin(t) * 15}% ${50 - Math.sin(t) * 15}% ${50 + Math.cos(t * 1.2) * 18}% ${50 - Math.cos(t * 1.2) * 18}% / ${50 + Math.cos(t) * 12}% ${50 + Math.sin(t * 0.8) * 14}% ${50 - Math.sin(t * 0.8) * 14}% ${50 - Math.cos(t) * 12}%`,
          background: 'radial-gradient(circle, rgba(239,68,68,0.55) 0%, rgba(220,38,38,0.25) 45%, transparent 70%)',
          filter: 'blur(40px)', transition: 'all 0.07s linear',
        }} />

      {/* Smaller secondary blob */}
      <div className="absolute pointer-events-none"
        style={{
          top: '20%', right: '8%', width: 200, height: 200,
          transform: `scale(${0.9 + Math.cos(t * 1.3) * 0.15})`,
          borderRadius: `${60 + Math.cos(t * 0.9) * 20}% ${40 - Math.cos(t * 0.9) * 20}% ${55 + Math.sin(t) * 15}% ${45 - Math.sin(t) * 15}%`,
          background: 'radial-gradient(circle, rgba(239,68,68,0.4) 0%, transparent 70%)',
          filter: 'blur(30px)', transition: 'all 0.07s linear',
        }} />

      <div className="relative w-full max-w-sm" style={{
        background: 'rgba(20,10,10,0.55)', backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(239,68,68,0.18)', borderRadius: 28, padding: '36px 28px',
        boxShadow: '0 30px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}>
        <div className="text-center mb-7">
          <div className="inline-block w-14 h-14 rounded-2xl mb-3 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #EF4444, #7f1d1d)',
              boxShadow: '0 8px 24px rgba(239,68,68,0.5)' }}>
            <span className="absolute inset-0 flex items-center justify-center text-white font-black text-2xl">R</span>
          </div>
          <h2 className="text-white text-2xl font-bold tracking-tight">Welcome back</h2>
          <p className="text-white/50 text-sm mt-1">Sign in to keep training</p>
        </div>

        <div className="space-y-3">
          <input value={id} onChange={(e) => setId(e.target.value)} placeholder="Email or phone"
            className="w-full text-white text-[15px] px-4 py-3.5 focus:outline-none placeholder:text-white/30"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14, backdropFilter: 'blur(8px)' }} />
          <input value={pw} onChange={(e) => setPw(e.target.value)} type="password" placeholder="Password"
            className="w-full text-white text-[15px] px-4 py-3.5 focus:outline-none placeholder:text-white/30"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14, backdropFilter: 'blur(8px)' }} />
          <div className="text-right">
            <span className="text-white/50 text-xs">Forgot password?</span>
          </div>
          <button className="w-full text-white font-bold py-3.5 text-sm active:scale-[0.98] transition-transform"
            style={{
              background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
              borderRadius: 14,
              boxShadow: `0 8px 28px rgba(239,68,68,${0.35 + Math.sin(t * 2) * 0.15}), inset 0 1px 0 rgba(255,255,255,0.2)`,
              letterSpacing: '0.05em',
            }}>
            Sign In
          </button>
        </div>

        <p className="text-center text-white/50 text-xs mt-6">
          New here? <span className="text-wf-red font-semibold">Create account</span>
        </p>
      </div>
    </div>
  );
}

/* ================================================================
   3. BRUTALIST SLASH — Diagonal red trapezoid, monospace, sharp
   ================================================================ */
function BrutalistSlash() {
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  return (
    <div className="relative overflow-hidden" style={{ background: '#0a0a0a', minHeight: 640 }}>
      {/* Diagonal red slab */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: '#EF4444',
        clipPath: 'polygon(0 0, 65% 0, 35% 100%, 0 100%)',
        opacity: 0.92,
      }} />
      {/* Black scratchy shadow on slash edge */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'rgba(0,0,0,0.4)',
        clipPath: 'polygon(64% 0, 66% 0, 36% 100%, 34% 100%)',
        filter: 'blur(2px)',
      }} />
      {/* Repeating diagonal lines on red slab */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 8px, rgba(0,0,0,0.06) 8px 9px)',
        clipPath: 'polygon(0 0, 65% 0, 35% 100%, 0 100%)',
      }} />

      <div className="relative px-6 pt-12 pb-10">
        <div className="font-mono text-[10px] text-black/80 tracking-[0.3em]">// REPLAB.SYS</div>
        <h1 className="text-white font-black leading-[0.9] tracking-tight mt-6"
          style={{ fontSize: 56, fontFamily: 'ui-monospace, "SF Mono", monospace' }}>
          ACCESS<br/>POINT_
        </h1>
        <div className="font-mono text-[10px] text-white/50 mt-3 tracking-widest">[ AUTH REQUIRED ]</div>

        <div className="mt-12 space-y-4 max-w-sm">
          <div>
            <label className="font-mono text-[10px] text-white/60 tracking-widest block mb-1">&gt; USER_ID</label>
            <input value={id} onChange={(e) => setId(e.target.value)} placeholder="email or phone"
              className="w-full bg-black text-white font-mono text-[14px] px-3 py-3 focus:outline-none placeholder:text-white/25"
              style={{ border: '2px solid #EF4444', borderRadius: 0 }} />
          </div>
          <div>
            <label className="font-mono text-[10px] text-white/60 tracking-widest block mb-1">&gt; PASSCODE</label>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••"
              className="w-full bg-black text-white font-mono text-[14px] px-3 py-3 focus:outline-none placeholder:text-white/25"
              style={{ border: '2px solid #EF4444', borderRadius: 0 }} />
          </div>
          <button className="w-full text-black font-black font-mono py-3.5 text-[13px] tracking-[0.3em] active:translate-x-[2px] active:translate-y-[2px] transition-transform"
            style={{ background: '#EF4444', borderRadius: 0,
              boxShadow: '4px 4px 0 #fff, 4px 4px 0 1px #EF4444' }}>
            EXECUTE &gt;&gt;
          </button>
          <div className="flex justify-between font-mono text-[10px] text-white/50 tracking-widest pt-2">
            <span>RESET_PW.exe</span>
            <span className="text-wf-red">REGISTER &gt;</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   4. CINEMATIC LIGHT LEAKS — Dark hero w/ drifting red light leaks
   DYNAMIC
   ================================================================ */
function CinematicLightLeaks() {
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const phase = useBreath(60);
  const t = phase * 0.04;

  return (
    <div className="relative overflow-hidden flex flex-col justify-end"
      style={{ background: '#000', minHeight: 640 }}>
      {/* Drifting light leak 1 */}
      <div className="absolute pointer-events-none" style={{
        top: `${10 + Math.sin(t) * 10}%`, left: `${-15 + Math.cos(t * 0.7) * 10}%`,
        width: 380, height: 380,
        background: 'radial-gradient(circle, rgba(239,68,68,0.45) 0%, transparent 60%)',
        filter: 'blur(50px)', transition: 'all 0.5s linear',
      }} />
      {/* Light leak 2 */}
      <div className="absolute pointer-events-none" style={{
        top: `${30 + Math.cos(t * 1.1) * 15}%`, right: `${-10 + Math.sin(t * 0.9) * 8}%`,
        width: 320, height: 320,
        background: 'radial-gradient(circle, rgba(220,38,38,0.55) 0%, transparent 60%)',
        filter: 'blur(60px)', transition: 'all 0.5s linear',
      }} />
      {/* Lens flare streak */}
      <div className="absolute pointer-events-none" style={{
        top: '20%', left: '50%',
        width: 800, height: 2,
        transform: `translateX(-50%) rotate(${Math.sin(t * 0.5) * 15}deg)`,
        background: 'linear-gradient(90deg, transparent 20%, rgba(239,68,68,0.6) 50%, transparent 80%)',
        filter: 'blur(2px)', opacity: 0.7,
      }} />
      {/* Grain overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '3px 3px' }} />

      {/* Hero copy */}
      <div className="relative px-6 pt-16 pb-4">
        <p className="text-[10px] text-wf-red uppercase tracking-[0.4em] font-bold mb-3">RepLab</p>
        <h1 className="text-white font-black leading-[0.95] tracking-tight"
          style={{ fontSize: 44, textShadow: '0 4px 30px rgba(0,0,0,0.7)' }}>
          The work is<br/>the reward.
        </h1>
      </div>

      {/* Bottom-sheet form */}
      <div className="relative mt-auto px-6 pb-10 pt-8" style={{
        background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.85) 30%, #000 70%)',
      }}>
        <div className="space-y-3 max-w-sm mx-auto">
          <input value={id} onChange={(e) => setId(e.target.value)} placeholder="Email or phone"
            className="w-full text-white text-[15px] px-4 py-3.5 focus:outline-none placeholder:text-white/35"
            style={{
              background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
            }} />
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password"
            className="w-full text-white text-[15px] px-4 py-3.5 focus:outline-none placeholder:text-white/35"
            style={{
              background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
            }} />
          <button className="w-full text-white font-bold py-3.5 text-[14px] tracking-wider active:scale-[0.98] transition-transform"
            style={{
              background: 'linear-gradient(135deg, #EF4444, #B91C1C)',
              borderRadius: 12,
              boxShadow: '0 12px 40px rgba(239,68,68,0.45), inset 0 1px 0 rgba(255,255,255,0.18)',
            }}>
            CONTINUE
          </button>
          <div className="flex items-center justify-between pt-2">
            <span className="text-white/40 text-xs">Forgot password</span>
            <span className="text-wf-red text-xs font-semibold">Create account</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   5. NIKE STAMP CARD — Sharp 2px corners, ribbed paper, brand mark
   ================================================================ */
function NikeStampCard() {
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  return (
    <div className="relative flex items-center justify-center px-5 py-10"
      style={{ background: 'linear-gradient(180deg, #0d0d0d 0%, #1a0808 100%)', minHeight: 640 }}>
      <div className="relative w-full max-w-sm" style={{
        background: '#111',
        boxShadow: '0 30px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
        borderRadius: 2,
      }}>
        {/* Top stamp band */}
        <div className="relative px-6 pt-6 pb-5" style={{
          background: 'linear-gradient(90deg, #EF4444 0%, #DC2626 100%)',
          borderBottom: '4px double rgba(0,0,0,0.5)',
        }}>
          <div className="absolute top-2 right-3 text-[8px] text-black/60 font-mono tracking-widest">№ 001</div>
          <p className="text-black/70 text-[10px] uppercase tracking-[0.4em] font-bold mb-1">Members Only</p>
          <h2 className="text-white font-black tracking-tighter leading-none" style={{ fontSize: 36 }}>
            JUST<br/>LIFT.
          </h2>
          <div className="mt-3 flex gap-1">
            <span className="block w-8 h-[2px] bg-black" />
            <span className="block w-3 h-[2px] bg-black" />
            <span className="block w-1 h-[2px] bg-black" />
          </div>
        </div>

        {/* Ribbed dark body */}
        <div className="relative px-6 py-7" style={{
          backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.012) 0 2px, transparent 2px 4px)',
        }}>
          <div className="space-y-5">
            <div>
              <label className="text-[9px] text-white/40 uppercase tracking-[0.35em] block mb-1.5">Email / Phone</label>
              <input value={id} onChange={(e) => setId(e.target.value)} placeholder="you@replab.com"
                className="w-full bg-black/60 text-white text-[14px] px-3 py-3 focus:outline-none placeholder:text-white/25 focus:border-wf-red"
                style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2 }} />
            </div>
            <div>
              <label className="text-[9px] text-white/40 uppercase tracking-[0.35em] block mb-1.5">Password</label>
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••"
                className="w-full bg-black/60 text-white text-[14px] px-3 py-3 focus:outline-none placeholder:text-white/25"
                style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2 }} />
            </div>
            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.25em]">
              <label className="flex items-center gap-2 text-white/50">
                <span className="block w-3 h-3" style={{ border: '1px solid #EF4444', borderRadius: 1 }} />
                Remember
              </label>
              <span className="text-white/40">Reset PW</span>
            </div>
            <button className="w-full text-white font-black uppercase py-3.5 text-[12px] tracking-[0.3em] active:translate-y-[1px] transition-transform"
              style={{
                background: '#EF4444',
                borderRadius: 2,
                boxShadow: '0 6px 0 #7f1d1d, 0 10px 24px rgba(239,68,68,0.3)',
              }}>
              SIGN IN
            </button>
          </div>
        </div>

        {/* Footer ticket-stub */}
        <div className="px-6 py-4 flex items-center justify-between text-[10px] uppercase tracking-[0.25em]"
          style={{ borderTop: '1px dashed rgba(255,255,255,0.12)' }}>
          <span className="text-white/40">Not a member?</span>
          <span className="text-wf-red font-black">JOIN →</span>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   6. AURORA PULSE — 3 floating red orbs at different speeds + glow ring
   DYNAMIC
   ================================================================ */
function AuroraPulse() {
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const phase = useBreath(50);
  const t = phase * 0.05;

  return (
    <div className="relative overflow-hidden flex items-center justify-center px-6 py-12"
      style={{ background: '#040404', minHeight: 640 }}>
      {/* Orb 1 */}
      <div className="absolute pointer-events-none" style={{
        top: `${20 + Math.sin(t) * 12}%`, left: `${15 + Math.cos(t) * 10}%`,
        width: 280, height: 280, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(239,68,68,0.6) 0%, transparent 65%)',
        filter: 'blur(50px)', transition: 'all 0.4s linear',
      }} />
      {/* Orb 2 */}
      <div className="absolute pointer-events-none" style={{
        top: `${55 + Math.cos(t * 1.4) * 10}%`, right: `${10 + Math.sin(t * 1.1) * 8}%`,
        width: 240, height: 240, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(220,38,38,0.55) 0%, transparent 65%)',
        filter: 'blur(45px)', transition: 'all 0.4s linear',
      }} />
      {/* Orb 3 */}
      <div className="absolute pointer-events-none" style={{
        bottom: `${10 + Math.sin(t * 0.8) * 8}%`, left: `${40 + Math.cos(t * 0.6) * 12}%`,
        width: 200, height: 200, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(127,29,29,0.7) 0%, transparent 65%)',
        filter: 'blur(40px)', transition: 'all 0.4s linear',
      }} />

      <div className="relative w-full max-w-sm">
        {/* Pulsing red ring around card */}
        <div className="absolute -inset-[1px] pointer-events-none" style={{
          borderRadius: 24,
          background: `conic-gradient(from ${(phase * 3.6) % 360}deg, rgba(239,68,68,0.7), rgba(239,68,68,0) 30%, rgba(239,68,68,0) 70%, rgba(239,68,68,0.7))`,
          filter: 'blur(2px)', transition: 'all 0.07s linear',
        }} />

        <div className="relative" style={{
          background: 'rgba(8,8,8,0.85)', backdropFilter: 'blur(20px)',
          border: '1px solid rgba(239,68,68,0.15)',
          borderRadius: 24, padding: '36px 28px',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
        }}>
          <div className="text-center mb-7">
            <div className="inline-block relative" style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(239,68,68,0.3), rgba(0,0,0,0.6))',
              border: '1px solid rgba(239,68,68,0.5)',
              boxShadow: `0 0 ${20 + Math.sin(t * 2) * 12}px rgba(239,68,68,${0.5 + Math.sin(t * 2) * 0.25})`,
            }}>
              <span className="absolute inset-0 flex items-center justify-center text-white font-black">R</span>
            </div>
            <h2 className="text-white text-[22px] font-bold tracking-tight mt-4">Welcome back</h2>
            <p className="text-white/40 text-[12px] mt-1">Lock in. Sign in to continue.</p>
          </div>

          <div className="space-y-3">
            <input value={id} onChange={(e) => setId(e.target.value)} placeholder="Email or phone"
              className="w-full text-white text-[15px] px-4 py-3.5 focus:outline-none placeholder:text-white/30 focus:border-wf-red transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: 999 }} />
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password"
              className="w-full text-white text-[15px] px-4 py-3.5 focus:outline-none placeholder:text-white/30 focus:border-wf-red transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: 999 }} />
            <div className="flex justify-end">
              <span className="text-white/40 text-[11px]">Forgot password?</span>
            </div>
            <button className="w-full text-white font-bold py-3.5 text-[14px] active:scale-[0.98] transition-transform"
              style={{
                background: 'linear-gradient(135deg, #EF4444, #B91C1C)',
                borderRadius: 999,
                boxShadow: `0 0 ${20 + Math.sin(t * 2) * 10}px rgba(239,68,68,0.5), inset 0 1px 0 rgba(255,255,255,0.18)`,
              }}>
              Sign In
            </button>
          </div>

          <p className="text-center text-white/40 text-[12px] mt-6">
            New here? <span className="text-wf-red font-semibold">Create account</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   7. NIKE STRIPE BANNER — Angled red header, pure black form below
   DYNAMIC (subtle moving stripe shimmer)
   ================================================================ */
function NikeStripeBanner() {
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const phase = useBreath(40);

  return (
    <div className="relative" style={{ background: '#0a0a0a', minHeight: 640 }}>
      {/* Angled red banner */}
      <div className="relative" style={{ height: 240, overflow: 'hidden' }}>
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 70%, #991B1B 100%)',
          clipPath: 'polygon(0 0, 100% 0, 100% 78%, 0 100%)',
        }} />
        {/* Moving shimmer stripe */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.18) 50%, transparent 70%)',
          backgroundSize: '300% 100%',
          backgroundPosition: `${(phase * 0.5) % 300}% 50%`,
          clipPath: 'polygon(0 0, 100% 0, 100% 78%, 0 100%)',
          mixBlendMode: 'overlay',
          transition: 'background-position 0.07s linear',
        }} />
        {/* Diagonal hatched lines */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.08]" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, transparent 0 6px, #000 6px 7px)',
          clipPath: 'polygon(0 0, 100% 0, 100% 78%, 0 100%)',
        }} />

        <div className="relative px-6 pt-12">
          <p className="text-black/70 text-[11px] uppercase tracking-[0.35em] font-black mb-2">REPLAB Fitness</p>
          <h1 className="text-white font-black leading-[0.85] tracking-tighter"
            style={{ fontSize: 64, fontFamily: 'system-ui', textShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
            LET'S<br/>LOCK IN<span className="text-black">.</span>
          </h1>
        </div>

        {/* Bottom corner tick mark */}
        <div className="absolute bottom-3 right-4 flex items-center gap-1">
          <span className="text-white text-[10px] uppercase tracking-[0.3em] font-black">Sign in</span>
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15m0 0l6.75-6.75M4.5 12l6.75 6.75" transform="scale(-1,1) translate(-24,0)" />
          </svg>
        </div>
      </div>

      {/* Pure black form */}
      <div className="relative px-6 -mt-2 pb-10">
        <div className="space-y-4 max-w-sm mx-auto">
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-[0.35em] font-bold block mb-2">▸ Email or Phone</label>
            <input value={id} onChange={(e) => setId(e.target.value)} placeholder="you@replab.com"
              className="w-full bg-[#1a1a1a] text-white text-[15px] px-4 py-3.5 focus:outline-none placeholder:text-white/25"
              style={{ border: '1px solid #2a2a2a', borderRadius: 2 }} />
          </div>
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-[0.35em] font-bold block mb-2">▸ Password</label>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••"
              className="w-full bg-[#1a1a1a] text-white text-[15px] px-4 py-3.5 focus:outline-none placeholder:text-white/25"
              style={{ border: '1px solid #2a2a2a', borderRadius: 2 }} />
          </div>
          <button className="w-full font-black uppercase py-4 text-[13px] tracking-[0.3em] active:scale-[0.98] transition-transform text-white"
            style={{
              background: '#EF4444', borderRadius: 2,
              boxShadow: '0 10px 30px rgba(239,68,68,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
            }}>
            Sign In →
          </button>
          <div className="flex items-center justify-between pt-2 text-[11px] uppercase tracking-[0.2em]">
            <span className="text-white/45">Forgot Password</span>
            <span className="text-wf-red font-black">JOIN NOW</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   8. APP STYLE — REFINED CURRENT
   Same exact aesthetic as the real Login (ambient-bg, glass-input,
   red gradient CTA with 2px corners), with subtle polish: drifting
   red glow halo behind the logo + a faint scan-line accent above
   the headline.
   DYNAMIC (uses the existing ambient-bg drift animations + halo)
   ================================================================ */
function AppStyleRefined() {
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const phase = useBreath(80);
  const t = phase * 0.04;

  return (
    <div className="relative bg-black flex flex-col items-center justify-center px-6 py-12" style={{ minHeight: 640 }}>
      <div className="ambient-bg" />

      {/* Pulsing halo behind logo */}
      <div className="absolute pointer-events-none" style={{
        top: '14%', left: '50%',
        transform: `translate(-50%, 0) scale(${1 + Math.sin(t) * 0.08})`,
        width: 280, height: 280,
        background: 'radial-gradient(circle, rgba(239,68,68,0.18) 0%, transparent 65%)',
        filter: 'blur(40px)', transition: 'transform 0.07s linear',
      }} />

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-10">
          <img src="/RepLabLogo3.jpg" alt="RepLab" className="mx-auto w-44"
            style={{ filter: 'drop-shadow(0 0 24px rgba(239,68,68,0.45))' }} />
          <p className="text-wf-gray-400 text-sm mt-3">Track Your Gains, Share Your Workouts, Level Up!</p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <span className="block w-8 h-px bg-gradient-to-r from-transparent to-wf-red/60" />
            <span className="text-[9px] text-wf-red uppercase tracking-[0.35em] font-bold">Sign In</span>
            <span className="block w-8 h-px bg-gradient-to-l from-transparent to-wf-red/60" />
          </div>
        </div>

        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div>
            <label className="text-xs text-wf-gray-400 uppercase tracking-wider mb-1 block">Email or Phone</label>
            <input value={id} onChange={(e) => setId(e.target.value)}
              placeholder="Email or phone number"
              className="w-full glass-input rounded-xl px-4 py-3.5 text-white text-base placeholder:text-wf-gray-500 focus:outline-none transition-all" />
          </div>
          <div>
            <label className="text-xs text-wf-gray-400 uppercase tracking-wider mb-1 block">Password</label>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)}
              placeholder="Enter password"
              className="w-full glass-input rounded-xl px-4 py-3.5 text-white text-base placeholder:text-wf-gray-500 focus:outline-none transition-all" />
          </div>
          <div className="flex justify-end">
            <span className="text-wf-gray-400 text-sm">Forgot password?</span>
          </div>
          <button type="submit" className="w-full active:scale-[0.98] text-white font-bold uppercase py-3.5 text-sm transition-transform"
            style={{
              letterSpacing: '0.15em', borderRadius: 2,
              background: 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)',
              boxShadow: '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
            }}>
            Sign In
          </button>
        </form>

        <p className="text-center text-wf-gray-400 text-sm mt-6">
          Don't have an account? <span className="text-wf-red font-medium">Sign Up</span>
        </p>
      </div>
    </div>
  );
}

/* ================================================================
   9. APP STYLE — GLASS CARD WRAPPED
   Form lives inside a real glass-card (matches the rest of the app
   where every section is a card). Same ambient bg, same inputs,
   same CTA — just framed.
   ================================================================ */
function AppStyleGlassCard() {
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');

  return (
    <div className="relative bg-black flex flex-col items-center justify-center px-4 py-12" style={{ minHeight: 640 }}>
      <div className="ambient-bg" />

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-6">
          <img src="/RepLabLogo3.jpg" alt="RepLab" className="mx-auto w-36"
            style={{ filter: 'drop-shadow(0 0 24px rgba(239,68,68,0.35))' }} />
        </div>

        <div className="glass-card rounded-3xl p-6"
          style={{ border: '1px solid rgba(239,68,68,0.18)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(239,68,68,0.08)' }}>
          <div className="text-center mb-5">
            <h2 className="text-white text-xl font-bold tracking-tight">Welcome back</h2>
            <p className="text-wf-gray-400 text-xs mt-1">Sign in to keep your streak alive</p>
          </div>

          <form className="space-y-3.5" onSubmit={(e) => e.preventDefault()}>
            <div>
              <label className="text-xs text-wf-gray-400 uppercase tracking-wider mb-1 block">Email or Phone</label>
              <input value={id} onChange={(e) => setId(e.target.value)}
                placeholder="Email or phone number"
                className="w-full glass-input rounded-xl px-4 py-3.5 text-white text-base placeholder:text-wf-gray-500 focus:outline-none transition-all" />
            </div>
            <div>
              <label className="text-xs text-wf-gray-400 uppercase tracking-wider mb-1 block">Password</label>
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)}
                placeholder="Enter password"
                className="w-full glass-input rounded-xl px-4 py-3.5 text-white text-base placeholder:text-wf-gray-500 focus:outline-none transition-all" />
            </div>
            <div className="flex justify-end">
              <span className="text-wf-gray-400 text-sm">Forgot password?</span>
            </div>
            <button type="submit" className="w-full active:scale-[0.98] text-white font-bold uppercase py-3.5 text-sm transition-transform"
              style={{
                letterSpacing: '0.15em', borderRadius: 2,
                background: 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)',
                boxShadow: '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
              }}>
              Sign In
            </button>
          </form>

          <div className="mt-5 pt-5 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-wf-gray-400 text-sm">
              Don't have an account? <span className="text-wf-red font-medium">Sign Up</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   10. APP STYLE — PREMIUM BORDER
   Uses the signature card style from the Workouts library
   (0.75px white border + soft outer white glow) layered over the
   real ambient-bg. LCD-style readouts pull from the workout-session
   input styling so login feels native to the rest of the app.
   DYNAMIC (subtle red ribbon shimmer along the top edge)
   ================================================================ */
function AppStylePremium() {
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const phase = useBreath(60);

  return (
    <div className="relative bg-black flex flex-col items-center justify-center px-4 py-12" style={{ minHeight: 640 }}>
      <div className="ambient-bg" />

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-6">
          <img src="/RepLabLogo3.jpg" alt="RepLab" className="mx-auto w-36"
            style={{ filter: 'drop-shadow(0 0 24px rgba(239,68,68,0.35))' }} />
          <p className="text-wf-gray-400 text-xs mt-3 uppercase tracking-[0.3em]">Welcome back</p>
        </div>

        <div className="relative rounded-3xl p-7 overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)',
            border: '0.75px solid rgba(255,255,255,0.3)',
            boxShadow: '0 0 20px rgba(255,255,255,0.07), 0 0 40px rgba(255,255,255,0.03)',
          }}>
          {/* Red ribbon shimmer along the top edge */}
          <div className="absolute top-0 left-0 right-0 h-px pointer-events-none" style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(239,68,68,0.7) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
            backgroundPosition: `${(phase * 1.2) % 200}% 50%`,
            transition: 'background-position 0.07s linear',
          }} />

          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div>
              <label className="text-[10px] text-wf-gray-400 uppercase tracking-[0.3em] mb-2 block">Email or Phone</label>
              <input value={id} onChange={(e) => setId(e.target.value)}
                placeholder="you@replab.com"
                className="lcd-input w-full rounded-xl px-4 py-3.5 text-white text-base placeholder:text-wf-gray-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-wf-gray-400 uppercase tracking-[0.3em] mb-2 block">Password</label>
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)}
                placeholder="••••••••"
                className="lcd-input w-full rounded-xl px-4 py-3.5 text-white text-base placeholder:text-wf-gray-500 focus:outline-none" />
            </div>
            <div className="flex justify-end">
              <span className="text-wf-gray-400 text-xs">Forgot password?</span>
            </div>
            <button type="submit" className="w-full active:scale-[0.98] text-white font-bold uppercase py-3.5 text-sm transition-transform"
              style={{
                letterSpacing: '0.15em', borderRadius: 2,
                background: 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)',
                boxShadow: '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
              }}>
              Sign In
            </button>
          </form>
        </div>

        <p className="text-center text-wf-gray-400 text-sm mt-6">
          Don't have an account? <span className="text-wf-red font-medium">Sign Up</span>
        </p>
      </div>
    </div>
  );
}

/* ================================================================
   PAGE
   ================================================================ */
export default function LoginScreensTest() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen" style={{ background: '#000' }}>
      <div className="px-4 pt-6 pb-3">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-wf-red text-sm font-medium active:opacity-70">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>
        <h1 className="text-2xl font-black text-white mt-4 mb-1">Login Screens</h1>
        <p className="text-xs text-wf-gray-500">7 design directions — red & black, Nike-style and not. Pick the bits you like.</p>
      </div>

      <div className="pt-4 pb-16">
        <Section index={1} title="Nike Knockout" tag="Static · Asymmetric">
          <NikeKnockout />
        </Section>
        <Section index={2} title="Organic Blob" tag="Dynamic · Glass card">
          <OrganicBlob />
        </Section>
        <Section index={3} title="Brutalist Slash" tag="Static · Diagonal slab">
          <BrutalistSlash />
        </Section>
        <Section index={4} title="Cinematic Light Leaks" tag="Dynamic · Bottom sheet">
          <CinematicLightLeaks />
        </Section>
        <Section index={5} title="Nike Stamp Card" tag="Static · Members card">
          <NikeStampCard />
        </Section>
        <Section index={6} title="Aurora Pulse" tag="Dynamic · Conic ring">
          <AuroraPulse />
        </Section>
        <Section index={7} title="Nike Stripe Banner" tag="Dynamic · Angled header">
          <NikeStripeBanner />
        </Section>

        <div className="px-4 mb-3 mt-12">
          <div className="text-[10px] text-wf-red uppercase tracking-[0.35em] font-bold mb-1">App Style — Drop-In Fits</div>
          <p className="text-xs text-wf-gray-500">Same ambient-bg, glass inputs, red gradient CTA — variations on the live Login.</p>
        </div>

        <Section index={8} title="Refined Current" tag="Dynamic · Halo + accent rule">
          <AppStyleRefined />
        </Section>
        <Section index={9} title="Glass Card Wrapped" tag="Static · Framed in glass-card">
          <AppStyleGlassCard />
        </Section>
        <Section index={10} title="Premium Border" tag="Dynamic · LCD inputs + ribbon">
          <AppStylePremium />
        </Section>
      </div>
    </div>
  );
}
