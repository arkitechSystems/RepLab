import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function CardsTest() {
  const navigate = useNavigate();
  const [toggleOn, setToggleOn] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [hoverCard, setHoverCard] = useState(null);
  const [breathPhase, setBreathPhase] = useState(0);
  const [activeTab, setActiveTab] = useState('week');
  const [sliderVal, setSliderVal] = useState(65);

  // Breathing animation timer
  useEffect(() => {
    const interval = setInterval(() => {
      setBreathPhase(p => (p + 1) % 100);
    }, 80);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-black px-4 pt-6 pb-24">
      <button onClick={() => navigate('/test')} className="flex items-center gap-1 text-wf-red text-sm font-medium mb-6 active:opacity-70">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back
      </button>

      <h1 className="text-2xl font-black text-white mb-2">Cards. Test.</h1>
      <p className="text-wf-gray-400 text-sm mb-6">10 card styles for UI exploration</p>

      <div className="space-y-5">

        {/* 1. Hero Card */}
        <div className="rounded-2xl overflow-hidden relative" style={{ minHeight: '180px' }}>
          <video
            ref={(el) => { if (el) { el.currentTime = 7; el.play().catch(() => {}); } }}
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay loop muted playsInline src="/Gym cinematic promotion video.mp4"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
          <div className="relative z-10 p-5 flex flex-col justify-end h-full" style={{ minHeight: '180px' }}>
            <div className="mt-auto">
              <p className="text-[10px] text-wf-gray-400 uppercase tracking-widest font-semibold mb-1">1. Hero Card</p>
              <h2 className="text-xl font-black text-white drop-shadow-lg">Full-Width Background</h2>
              <p className="text-white/60 text-sm mt-1">Video or image with text overlay at the bottom</p>
            </div>
          </div>
        </div>

        {/* 2. Stat Card */}
        <div className="glass-card rounded-2xl p-5">
          <p className="text-[10px] text-wf-gray-400 uppercase tracking-widest font-semibold mb-3">2. Stat Card</p>
          <div className="flex gap-4">
            <div className="flex-1 text-center">
              <div className="text-3xl font-black bg-gradient-to-r from-wf-red to-orange-400 bg-clip-text text-transparent">247</div>
              <div className="text-[10px] text-wf-gray-500 uppercase tracking-widest mt-1">Workouts</div>
            </div>
            <div className="w-px bg-white/10" />
            <div className="flex-1 text-center">
              <div className="text-3xl font-black bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">18</div>
              <div className="text-[10px] text-wf-gray-500 uppercase tracking-widest mt-1">Day Streak</div>
            </div>
            <div className="w-px bg-white/10" />
            <div className="flex-1 text-center">
              <div className="text-3xl font-black bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">42</div>
              <div className="text-[10px] text-wf-gray-500 uppercase tracking-widest mt-1">PRs</div>
            </div>
          </div>
        </div>

        {/* 3. Action Card */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <p className="text-[10px] text-wf-gray-400 uppercase tracking-widest font-semibold px-5 pt-4 mb-2">3. Action Card</p>
          {[
            { icon: '🏋️', title: 'Start Workout', subtitle: 'Continue where you left off' },
            { icon: '📊', title: 'View Progress', subtitle: 'Check your weekly stats' },
            { icon: '🎯', title: 'Set a Goal', subtitle: 'Target a new personal best' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-t border-white/5 active:bg-white/5 transition-colors cursor-pointer">
              <span className="text-2xl">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                <p className="text-xs text-wf-gray-500">{item.subtitle}</p>
              </div>
              <svg className="w-4 h-4 text-wf-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          ))}
        </div>

        {/* 4. Progress Card */}
        <div className="glass-card rounded-2xl p-5">
          <p className="text-[10px] text-wf-gray-400 uppercase tracking-widest font-semibold mb-4">4. Progress Card</p>
          <div className="flex items-center gap-5">
            {/* Circular progress ring */}
            <div className="relative w-20 h-20 shrink-0">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#ef4444" strokeWidth="3" strokeDasharray="97.4" strokeDashoffset="24.4" strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-black text-white">75%</span>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-white">Weekly Goal</h3>
              <p className="text-xs text-wf-gray-400 mt-1">3 of 4 workouts completed</p>
              <div className="mt-3 h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-wf-red to-orange-400 rounded-full" style={{ width: '75%' }} />
              </div>
            </div>
          </div>
        </div>

        {/* 5. Notification/Banner Card */}
        {!dismissed && (
          <div className="rounded-2xl overflow-hidden border-l-4 border-yellow-500 bg-yellow-500/10">
            <div className="p-4 flex items-start gap-3">
              <p className="text-[10px] text-wf-gray-400 uppercase tracking-widest font-semibold shrink-0 mt-0.5">5.</p>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-yellow-400">Notification / Banner Card</h3>
                <p className="text-xs text-wf-gray-400 mt-1">Colored accent border with a message. Great for alerts, tips, or promotions.</p>
              </div>
              <button onClick={() => setDismissed(true)} className="text-wf-gray-500 active:text-white shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* 6. Carousel Card */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <p className="text-[10px] text-wf-gray-400 uppercase tracking-widest font-semibold px-5 pt-4 mb-3">6. Carousel Card</p>
          <div className="flex gap-3 overflow-x-auto px-5 pb-5 snap-x snap-mandatory scrollbar-hide">
            {['Push Day', 'Pull Day', 'Leg Day', 'Upper Body', 'Core'].map((name, i) => (
              <div key={i} className="snap-center shrink-0 w-32 bg-white/5 border border-white/10 rounded-xl p-4 cursor-pointer active:scale-95 transition-transform">
                <div className={`w-10 h-10 rounded-full mb-3 flex items-center justify-center text-white text-sm font-bold ${
                  ['bg-wf-red', 'bg-wf-blue', 'bg-wf-green', 'bg-wf-purple', 'bg-wf-orange'][i]
                }`}>{name[0]}</div>
                <h4 className="text-sm font-semibold text-white">{name}</h4>
                <p className="text-[10px] text-wf-gray-500 mt-1">4 exercises</p>
              </div>
            ))}
          </div>
        </div>

        {/* 7. Toggle Card */}
        <div className="glass-card rounded-2xl p-5">
          <p className="text-[10px] text-wf-gray-400 uppercase tracking-widest font-semibold mb-3">7. Toggle Card</p>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Rest Timer</h3>
              <p className="text-xs text-wf-gray-500 mt-0.5">Auto-start timer between sets</p>
            </div>
            <button
              onClick={() => setToggleOn(!toggleOn)}
              className={`w-12 h-7 rounded-full transition-colors duration-200 relative ${toggleOn ? 'bg-wf-red' : 'bg-white/15'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-all duration-200 ${toggleOn ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
        </div>

        {/* 8. Profile/Avatar Card */}
        <div className="glass-card rounded-2xl p-5">
          <p className="text-[10px] text-wf-gray-400 uppercase tracking-widest font-semibold mb-3">8. Profile / Avatar Card</p>
          <div className="space-y-3">
            {[
              { name: 'Will M.', reps: '52 pushups', rank: 1, color: 'from-yellow-500 to-orange-500' },
              { name: 'Sarah K.', reps: '48 pushups', rank: 2, color: 'from-blue-500 to-purple-500' },
              { name: 'Jake R.', reps: '41 pushups', rank: 3, color: 'from-green-500 to-emerald-500' },
            ].map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${p.color} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
                  {p.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-white">{p.name}</h4>
                  <p className="text-xs text-wf-gray-500">{p.reps}</p>
                </div>
                <span className={`text-sm font-black ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : 'text-orange-400'}`}>#{p.rank}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 9. Expandable/Accordion Card */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full p-5 flex items-center justify-between active:bg-white/5 transition-colors"
          >
            <div className="text-left">
              <p className="text-[10px] text-wf-gray-400 uppercase tracking-widest font-semibold mb-1">9. Expandable / Accordion Card</p>
              <h3 className="text-base font-bold text-white">Bench Press</h3>
              <p className="text-xs text-wf-gray-500 mt-0.5">3 sets &middot; 200 lbs</p>
            </div>
            <svg
              className={`w-5 h-5 text-wf-gray-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          {expanded && (
            <div className="border-t border-white/5 px-5 py-4 space-y-2 bg-white/[0.02]">
              {[1, 2, 3].map(s => (
                <div key={s} className="flex items-center justify-between py-2">
                  <span className="text-xs text-wf-gray-500 font-bold">Set {s}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">200 lbs</span>
                    <span className="text-xs text-wf-gray-600">&times;</span>
                    <span className="text-sm font-bold text-wf-red">10 reps</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 10. Gradient CTA Card */}
        <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-wf-red via-red-600 to-orange-500 p-5">
          <p className="text-[10px] text-white/50 uppercase tracking-widest font-semibold mb-2">10. Gradient CTA Card</p>
          <h2 className="text-xl font-black text-white mb-1">Upgrade to Pro</h2>
          <p className="text-sm text-white/70 mb-4">Unlock featured workouts, AI training, and advanced analytics.</p>
          <button className="w-full py-3 bg-white text-black font-bold text-sm rounded-xl active:scale-[0.98] transition-transform">
            Start Free Trial
          </button>
        </div>

        {/* ──── NEW EXPERIMENTAL CARDS ──── */}
        <div className="border-t border-white/10 pt-6 mt-4">
          <p className="text-wf-gray-400 text-xs uppercase tracking-widest font-semibold mb-5">Experimental Styles</p>
        </div>

        {/* 11. Brutalist / Newsprint Card */}
        <div style={{
          background: '#f5f0e8',
          border: '3px solid #1a1a1a',
          borderRadius: '0',
          padding: '0',
          fontFamily: '"Courier New", monospace',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            background: '#1a1a1a',
            padding: '8px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ color: '#f5f0e8', fontSize: '10px', fontWeight: 900, letterSpacing: '4px', textTransform: 'uppercase' }}>11. Brutalist</span>
            <span style={{ color: '#f5f0e8', fontSize: '10px', fontFamily: 'monospace' }}>03.22.26</span>
          </div>
          <div style={{ padding: '20px', borderBottom: '2px dashed #1a1a1a' }}>
            <h2 style={{ color: '#1a1a1a', fontSize: '32px', fontWeight: 900, lineHeight: 1, margin: 0, textTransform: 'uppercase', letterSpacing: '-1px' }}>
              DEADLIFT<br/>
              <span style={{ fontSize: '64px', lineHeight: 0.9 }}>315</span>
              <span style={{ fontSize: '16px', verticalAlign: 'super' }}>LBS</span>
            </h2>
          </div>
          <div style={{ display: 'flex', borderTop: '0' }}>
            {['SETS: 5', 'REPS: 3', 'RPE: 9'].map((stat, i) => (
              <div key={i} style={{
                flex: 1,
                padding: '12px',
                textAlign: 'center',
                borderRight: i < 2 ? '2px solid #1a1a1a' : 'none',
                color: '#1a1a1a',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '1px',
              }}>{stat}</div>
            ))}
          </div>
          <div style={{
            background: '#ff3b3b',
            color: '#fff',
            padding: '10px 16px',
            fontSize: '11px',
            fontWeight: 900,
            textAlign: 'center',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}>
            ► LOG THIS SET ◄
          </div>
        </div>

        {/* 12. Organic / Breathing Blob Card */}
        <div style={{
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a0a2e 50%, #0a1628 100%)',
          borderRadius: '24px',
          padding: '32px 24px',
          position: 'relative',
          overflow: 'hidden',
          minHeight: '200px',
        }}>
          {/* Animated blob background */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '180px',
            height: '180px',
            transform: `translate(-50%, -50%) scale(${0.8 + Math.sin(breathPhase * 0.063) * 0.2})`,
            borderRadius: `${40 + Math.sin(breathPhase * 0.04) * 15}% ${60 - Math.sin(breathPhase * 0.04) * 15}% ${50 + Math.cos(breathPhase * 0.05) * 10}% ${50 - Math.cos(breathPhase * 0.05) * 10}%`,
            background: `radial-gradient(circle, rgba(139,92,246,0.4) 0%, rgba(59,130,246,0.2) 50%, transparent 70%)`,
            filter: 'blur(20px)',
            transition: 'all 0.08s linear',
          }} />
          <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
            <p style={{ fontSize: '10px', color: 'rgba(167,139,250,0.6)', letterSpacing: '4px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '16px' }}>12. Organic Blob</p>
            <div style={{
              fontSize: '48px',
              fontWeight: 200,
              color: 'white',
              letterSpacing: '-2px',
              lineHeight: 1,
              fontFamily: 'system-ui',
            }}>
              {Math.round(60 + Math.sin(breathPhase * 0.063) * 8)}
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(167,139,250,0.5)', marginTop: '4px', letterSpacing: '2px' }}>BPM</div>
            <div style={{
              marginTop: '20px',
              display: 'flex',
              justifyContent: 'center',
              gap: '3px',
            }}>
              {Array.from({ length: 30 }, (_, i) => {
                const h = 8 + Math.sin((breathPhase + i * 3) * 0.1) * 16;
                return (
                  <div key={i} style={{
                    width: '3px',
                    height: `${h}px`,
                    borderRadius: '2px',
                    background: `linear-gradient(to top, rgba(139,92,246,${0.3 + (h / 40)}), rgba(59,130,246,${0.3 + (h / 40)}))`,
                    transition: 'height 0.08s linear',
                  }} />
                );
              })}
            </div>
          </div>
        </div>

        {/* 13. Retro Terminal / Hacker Card */}
        <div style={{
          background: '#0c0c0c',
          border: '1px solid #00ff4130',
          borderRadius: '8px',
          fontFamily: '"Courier New", "Lucida Console", monospace',
          overflow: 'hidden',
          boxShadow: '0 0 30px rgba(0,255,65,0.05), inset 0 0 60px rgba(0,255,65,0.03)',
        }}>
          {/* Terminal header */}
          <div style={{
            background: '#151515',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            borderBottom: '1px solid #00ff4115',
          }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f56' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#27c93f' }} />
            <span style={{ color: '#00ff4160', fontSize: '10px', marginLeft: '8px' }}>replab@gym:~</span>
          </div>
          <div style={{ padding: '16px', lineHeight: 1.8 }}>
            <p style={{ fontSize: '10px', color: '#00ff4140', letterSpacing: '4px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '8px' }}>13. Terminal Card</p>
            <div style={{ color: '#00ff41', fontSize: '12px' }}>
              <span style={{ color: '#00ff4180' }}>$</span> query --user=will --type=workout_summary<br />
              <br />
              <span style={{ color: '#888' }}>{'// '}loading workout data...</span><br />
              <br />
              <span style={{ color: '#ffbd2e' }}>WORKOUT_LOG</span> = {'{'}<br />
              &nbsp;&nbsp;<span style={{ color: '#ff6b6b' }}>"exercise"</span>: <span style={{ color: '#98c379' }}>"Squat"</span>,<br />
              &nbsp;&nbsp;<span style={{ color: '#ff6b6b' }}>"weight"</span>:&nbsp;&nbsp; <span style={{ color: '#d19a66' }}>275</span>,<br />
              &nbsp;&nbsp;<span style={{ color: '#ff6b6b' }}>"sets"</span>:&nbsp;&nbsp;&nbsp;&nbsp; <span style={{ color: '#d19a66' }}>4</span>,<br />
              &nbsp;&nbsp;<span style={{ color: '#ff6b6b' }}>"reps"</span>:&nbsp;&nbsp;&nbsp;&nbsp; <span style={{ color: '#d19a66' }}>6</span>,<br />
              &nbsp;&nbsp;<span style={{ color: '#ff6b6b' }}>"status"</span>:&nbsp;&nbsp; <span style={{ color: '#27c93f' }}>"PR_ACHIEVED"</span><br />
              {'}'}<br />
              <br />
              <span style={{ color: '#00ff4180' }}>$</span> <span style={{
                borderRight: '2px solid #00ff41',
                paddingRight: '2px',
                animation: 'none',
              }}>█</span>
            </div>
          </div>
        </div>

        {/* 14. Neumorphic / Soft UI Card */}
        <div style={{
          background: '#e0e5ec',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '8px 8px 16px #b8bec7, -8px -8px 16px #ffffff',
        }}>
          <p style={{ fontSize: '10px', color: '#8a95a5', letterSpacing: '4px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '16px' }}>14. Neumorphic</p>

          {/* Segmented control */}
          <div style={{
            display: 'flex',
            background: '#e0e5ec',
            borderRadius: '12px',
            padding: '4px',
            boxShadow: 'inset 3px 3px 6px #b8bec7, inset -3px -3px 6px #ffffff',
            marginBottom: '20px',
          }}>
            {['week', 'month', 'year'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                flex: 1,
                padding: '8px',
                borderRadius: '10px',
                border: 'none',
                fontSize: '12px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                cursor: 'pointer',
                color: activeTab === tab ? '#5b6abf' : '#8a95a5',
                background: activeTab === tab ? '#e0e5ec' : 'transparent',
                boxShadow: activeTab === tab ? '4px 4px 8px #b8bec7, -4px -4px 8px #ffffff' : 'none',
                transition: 'all 0.2s',
              }}>{tab}</button>
            ))}
          </div>

          {/* Stat blocks */}
          <div style={{ display: 'flex', gap: '12px' }}>
            {[
              { label: 'Volume', value: '24,500', unit: 'lbs' },
              { label: 'Sessions', value: '5', unit: 'days' },
            ].map((s, i) => (
              <div key={i} style={{
                flex: 1,
                background: '#e0e5ec',
                borderRadius: '16px',
                padding: '16px',
                boxShadow: '6px 6px 12px #b8bec7, -6px -6px 12px #ffffff',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#3a4255', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: '10px', color: '#8a95a5', marginTop: '4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>{s.unit}</div>
                <div style={{ fontSize: '11px', color: '#5b6abf', marginTop: '8px', fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Neumorphic slider */}
          <div style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', color: '#8a95a5', fontWeight: 600 }}>Intensity</span>
              <span style={{ fontSize: '11px', color: '#5b6abf', fontWeight: 700 }}>{sliderVal}%</span>
            </div>
            <div style={{
              height: '8px',
              borderRadius: '4px',
              background: '#e0e5ec',
              boxShadow: 'inset 2px 2px 4px #b8bec7, inset -2px -2px 4px #ffffff',
              position: 'relative',
              cursor: 'pointer',
            }} onClick={e => {
              const rect = e.currentTarget.getBoundingClientRect();
              setSliderVal(Math.round(((e.clientX - rect.left) / rect.width) * 100));
            }}>
              <div style={{
                height: '100%',
                width: `${sliderVal}%`,
                borderRadius: '4px',
                background: 'linear-gradient(90deg, #667eea, #764ba2)',
              }} />
              <div style={{
                position: 'absolute',
                top: '50%',
                left: `${sliderVal}%`,
                transform: 'translate(-50%, -50%)',
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: '#e0e5ec',
                boxShadow: '3px 3px 6px #b8bec7, -3px -3px 6px #ffffff',
              }} />
            </div>
          </div>
        </div>

        {/* 15. Glassmorphic Layered / Stacked Card */}
        <div style={{
          position: 'relative',
          minHeight: '240px',
          perspective: '1000px',
        }}>
          {/* Background decorative layers */}
          <div style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '24px',
            background: 'linear-gradient(135deg, #ff6b6b 0%, #feca57 25%, #48dbfb 50%, #ff9ff3 75%, #54a0ff 100%)',
            filter: 'blur(24px)',
            opacity: 0.3,
            transform: 'scale(0.95) translateY(8px)',
          }} />
          <div style={{
            position: 'relative',
            borderRadius: '24px',
            background: 'rgba(255,255,255,0.08)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            border: '1px solid rgba(255,255,255,0.15)',
            padding: '28px 24px',
            overflow: 'hidden',
          }}>
            {/* Decorative circles */}
            <div style={{
              position: 'absolute', top: -30, right: -30,
              width: 120, height: 120, borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(255,107,107,0.3), rgba(254,202,87,0.1))',
              filter: 'blur(10px)',
            }} />
            <div style={{
              position: 'absolute', bottom: -20, left: -20,
              width: 80, height: 80, borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(72,219,251,0.3), rgba(84,160,255,0.1))',
              filter: 'blur(10px)',
            }} />

            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', letterSpacing: '4px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '16px', position: 'relative', zIndex: 1 }}>15. Glass Layers</p>

            {/* Floating mini cards */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', position: 'relative', zIndex: 1 }}>
              {[
                { emoji: '🔥', val: '847', label: 'cal' },
                { emoji: '⏱', val: '52m', label: 'time' },
                { emoji: '💪', val: '12k', label: 'lbs' },
              ].map((item, i) => (
                <div key={i}
                  onPointerEnter={() => setHoverCard(i)}
                  onPointerLeave={() => setHoverCard(null)}
                  style={{
                    flex: 1,
                    background: hoverCard === i
                      ? 'rgba(255,255,255,0.18)'
                      : 'rgba(255,255,255,0.06)',
                    borderRadius: '16px',
                    padding: '14px 8px',
                    textAlign: 'center',
                    border: '1px solid rgba(255,255,255,0.1)',
                    transform: hoverCard === i ? 'translateY(-4px) scale(1.03)' : 'none',
                    transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    cursor: 'pointer',
                  }}>
                  <div style={{ fontSize: '20px', marginBottom: '4px' }}>{item.emoji}</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'white' }}>{item.val}</div>
                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '2px', marginTop: '2px' }}>{item.label}</div>
                </div>
              ))}
            </div>

            {/* Tag pills */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
              {['Upper Body', 'Strength', 'PR Day', 'Progressive'].map((tag, i) => (
                <span key={i} style={{
                  padding: '5px 12px',
                  borderRadius: '100px',
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.5px',
                  background: [
                    'rgba(255,107,107,0.15)',
                    'rgba(254,202,87,0.15)',
                    'rgba(72,219,251,0.15)',
                    'rgba(255,159,243,0.15)',
                  ][i],
                  color: [
                    '#ff6b6b',
                    '#feca57',
                    '#48dbfb',
                    '#ff9ff3',
                  ][i],
                  border: `1px solid ${[
                    'rgba(255,107,107,0.2)',
                    'rgba(254,202,87,0.2)',
                    'rgba(72,219,251,0.2)',
                    'rgba(255,159,243,0.2)',
                  ][i]}`,
                }}>{tag}</span>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
